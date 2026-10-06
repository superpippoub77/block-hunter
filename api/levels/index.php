<?php
// Game levels (data/level/<id>.json) with versions for the level editor (same API as server.js):
//   GET  ?                       -> list of levels
//   GET  ?id=level10             -> level json
//   GET  ?id=level10&versions=1  -> versions (newest first)
//   GET  ?id=level10&version=V   -> one version
//   POST ?id=level10 {data,note} -> saves the level; every save is kept as a version in
//                                   data/level-versions/<id>/ (the first save also keeps the original)
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$rootDir = realpath(__DIR__ . '/../../');
$levelDir = $rootDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'level';
$versionsRoot = $rootDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'level-versions';
$id = trim($_GET['id'] ?? '');
$VERSION_RE = '/^\d{8}-\d{6}-\d{3}$/';

function out($code, $payload) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function indent2($json) {
    return preg_replace_callback('/^(?: {4})+/m', function ($m) { return str_repeat(' ', strlen($m[0]) / 2); }, $json);
}
function pretty($value) {
    $json = json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    return $json === false ? false : indent2($json) . "\n";
}
function summary($data) {
    $map = is_object($data) && isset($data->map) && is_object($data->map) ? $data->map : null;
    $tiles = $map && isset($map->tiles) && is_array($map->tiles) ? $map->tiles : [];
    return [
        'levelId' => is_object($data) && isset($data->id) ? (string)$data->id : '',
        'cols' => $map && isset($map->cols) ? (int)$map->cols : (isset($tiles[0]) && is_array($tiles[0]) ? count($tiles[0]) : 0),
        'rows' => $map && isset($map->rows) ? (int)$map->rows : count($tiles)
    ];
}
function stamp() {
    $t = microtime(true);
    return date('Ymd-His', (int)$t) . '-' . str_pad((string)(int)(($t - floor($t)) * 1000), 3, '0', STR_PAD_LEFT);
}
function writeVersion($dir, $data, $note) {
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) return false;
    $v = stamp();
    while (is_file($dir . DIRECTORY_SEPARATOR . $v . '.json')) { usleep(1000); $v = stamp(); }
    $payload = ['version' => $v, 'savedAt' => gmdate('c'), 'note' => mb_substr((string)$note, 0, 200), 'data' => $data];
    $text = pretty($payload);
    if ($text === false || @file_put_contents($dir . DIRECTORY_SEPARATOR . $v . '.json', $text) === false) return false;
    return $v;
}
function jsonFiles($dir) {
    $out = [];
    foreach ((is_dir($dir) ? scandir($dir) : []) as $f) {
        if (substr($f, -5) === '.json') $out[] = $f;
    }
    return $out;
}

if ($id !== '' && !preg_match('/^[a-z0-9_-]+$/i', $id)) out(400, ['ok' => false, 'error' => 'invalid level id']);
$versionsDir = $versionsRoot . DIRECTORY_SEPARATOR . $id;

if ($method === 'GET') {
    if ($id === '') {
        $files = jsonFiles($levelDir);
        sort($files);
        $items = [];
        foreach ($files as $f) {
            $name = substr($f, 0, -5);
            $full = $levelDir . DIRECTORY_SEPARATOR . $f;
            $data = json_decode(@file_get_contents($full) ?: '');
            $item = ['id' => $name, 'file' => 'data/level/' . $f, 'modified' => gmdate('c', @filemtime($full) ?: time()),
                     'versions' => count(jsonFiles($versionsRoot . DIRECTORY_SEPARATOR . $name))];
            $items[] = array_merge($item, $data === null ? ['invalid' => true] : summary($data));
        }
        out(200, ['ok' => true, 'items' => $items]);
    }
    if (!empty($_GET['versions'])) {
        $files = array_values(array_filter(jsonFiles($versionsDir), function ($f) use ($VERSION_RE) { return preg_match($VERSION_RE, substr($f, 0, -5)); }));
        rsort($files);
        $items = [];
        foreach ($files as $f) {
            $v = json_decode(@file_get_contents($versionsDir . DIRECTORY_SEPARATOR . $f) ?: '');
            if (!is_object($v)) { $items[] = ['version' => substr($f, 0, -5), 'invalid' => true]; continue; }
            $items[] = array_merge(['version' => $v->version ?? substr($f, 0, -5), 'savedAt' => $v->savedAt ?? null, 'note' => $v->note ?? ''], summary($v->data ?? null));
        }
        out(200, ['ok' => true, 'id' => $id, 'items' => $items]);
    }
    $version = trim($_GET['version'] ?? '');
    if ($version !== '') {
        if (!preg_match($VERSION_RE, $version)) out(400, ['ok' => false, 'error' => 'invalid version']);
        $v = json_decode(@file_get_contents($versionsDir . DIRECTORY_SEPARATOR . $version . '.json') ?: '');
        if (!is_object($v)) out(404, ['ok' => false, 'error' => 'version not found']);
        out(200, ['ok' => true, 'id' => $id, 'version' => $version, 'note' => $v->note ?? '', 'savedAt' => $v->savedAt ?? null, 'data' => $v->data ?? null]);
    }
    $raw = @file_get_contents($levelDir . DIRECTORY_SEPARATOR . $id . '.json');
    if ($raw === false) out(404, ['ok' => false, 'error' => 'level not found']);
    $data = json_decode($raw);
    if (json_last_error() !== JSON_ERROR_NONE) out(500, ['ok' => false, 'error' => 'invalid level json']);
    out(200, ['ok' => true, 'id' => $id, 'data' => $data]);
}

if ($method === 'POST') {
    if ($id === '') out(400, ['ok' => false, 'error' => 'missing id']);
    $payload = json_decode(file_get_contents('php://input') ?: '', false);
    if (!is_object($payload) || !isset($payload->data) || !is_object($payload->data) || !isset($payload->data->map)) {
        out(400, ['ok' => false, 'error' => 'level data must be an object with a map']);
    }
    $file = $levelDir . DIRECTORY_SEPARATOR . $id . '.json';
    // first save of an existing level: keep the original as a version, so it can always come back
    if (is_file($file) && count(jsonFiles($versionsDir)) === 0) {
        $original = json_decode(@file_get_contents($file) ?: '');
        if (is_object($original)) writeVersion($versionsDir, $original, "Originale (prima del primo salvataggio dall'editor)");
    }
    $text = pretty($payload->data);
    if ($text === false || @file_put_contents($file, $text) === false) out(500, ['ok' => false, 'error' => 'unable to write level file']);
    $v = writeVersion($versionsDir, $payload->data, isset($payload->note) && $payload->note !== '' ? $payload->note : 'Salvataggio');
    if ($v === false) out(500, ['ok' => false, 'error' => 'unable to write version']);
    out(200, ['ok' => true, 'id' => $id, 'file' => 'data/level/' . $id . '.json', 'version' => $v]);
}

out(405, ['ok' => false, 'error' => 'method not allowed']);
