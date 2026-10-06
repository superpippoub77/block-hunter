<?php
// Screens designed in the screen editor: data/screens/<id>.json (same API as server.js)
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$rootDir = realpath(__DIR__ . '/../../');
$dir = $rootDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'screens';
$id = trim($_GET['id'] ?? '');

function out($code, $payload) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function indent2($json) {
    return preg_replace_callback('/^(?: {4})+/m', function ($m) { return str_repeat(' ', strlen($m[0]) / 2); }, $json);
}

if ($id !== '' && !preg_match('/^[a-z0-9_-]+$/i', $id)) out(400, ['ok' => false, 'error' => 'invalid screen id']);

if ($method === 'GET') {
    if ($id === '') {
        $items = [];
        foreach ((is_dir($dir) ? scandir($dir) : []) as $f) {
            if (substr($f, -5) === '.json') $items[] = substr($f, 0, -5);
        }
        sort($items);
        out(200, ['ok' => true, 'items' => $items]);
    }
    $raw = @file_get_contents($dir . DIRECTORY_SEPARATOR . $id . '.json');
    if ($raw === false) out(404, ['ok' => false, 'error' => 'screen not found']);
    $data = json_decode($raw);
    if (json_last_error() !== JSON_ERROR_NONE) out(500, ['ok' => false, 'error' => 'invalid screen json']);
    out(200, ['ok' => true, 'id' => $id, 'data' => $data]);
}

if ($method === 'POST') {
    if ($id === '') out(400, ['ok' => false, 'error' => 'missing id']);
    $payload = json_decode(file_get_contents('php://input') ?: '', false);
    if (!is_object($payload) || !isset($payload->data) || !is_object($payload->data)) out(400, ['ok' => false, 'error' => 'screen data must be an object']);
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) out(500, ['ok' => false, 'error' => 'cannot create screens directory']);
    $file = $dir . DIRECTORY_SEPARATOR . $id . '.json';
    if (is_file($file)) {
        $bck = $rootDir . DIRECTORY_SEPARATOR . 'bck';
        if (!is_dir($bck)) @mkdir($bck, 0755, true);
        @copy($file, $bck . DIRECTORY_SEPARATOR . 'screen-' . $id . '-' . date('Ymd-His') . '.json');
    }
    $json = json_encode($payload->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false || @file_put_contents($file, indent2($json) . "\n") === false) out(500, ['ok' => false, 'error' => 'unable to write file']);
    out(200, ['ok' => true, 'file' => 'data/screens/' . $id . '.json']);
}

out(405, ['ok' => false, 'error' => 'method not allowed']);
