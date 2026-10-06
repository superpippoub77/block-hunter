<?php
// Packages on PHP hosting: only the web package can be built here (Windows, Linux and Android need
// Node.js and Electron: run "npm run start:api" on your computer and use the editor from there).
header('Content-Type: application/json; charset=utf-8');
@set_time_limit(0);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$rootDir = realpath(__DIR__ . '/../../');
$distDir = $rootDir . DIRECTORY_SEPARATOR . 'dist';

function out($code, $payload) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$cfg = json_decode(@file_get_contents($rootDir . '/build.config.json') ?: '{}', true) ?: [];
$name = $cfg['productName'] ?? 'Game';
$ver = $cfg['version'] ?? '1.0.0';

if ($method === 'GET') {
    $files = [];
    foreach ((is_dir($distDir) ? scandir($distDir) : []) as $f) if ($f[0] !== '.') $files[] = 'dist/' . $f;
    out(200, ['ok' => true, 'server' => 'php', 'targets' => ['web' => class_exists('ZipArchive'), 'windows' => false, 'linux' => false, 'android' => false], 'androidSdk' => false, 'files' => $files]);
}

if ($method !== 'POST') out(405, ['ok' => false, 'error' => 'method not allowed']);
$target = strtolower($_GET['target'] ?? '');
if ($target !== 'web') out(400, ['ok' => false, 'error' => 'Su questo server si può creare solo il pacchetto web: per Windows, Linux e Android avvia "npm run start:api" sul tuo computer.']);
if (!class_exists('ZipArchive')) out(500, ['ok' => false, 'error' => 'ZipArchive non disponibile su questo server']);

$exclude = array_map(function ($g) { return '/^' . str_replace(['\*', '\?'], ['.*', '.'], preg_quote($g, '/')) . '$/i'; }, $cfg['exclude'] ?? []);
$isExcluded = function ($base) use ($exclude) { foreach ($exclude as $re) if (preg_match($re, $base)) return true; return false; };

if (!is_dir($distDir)) @mkdir($distDir, 0755, true);
$zipFile = $distDir . DIRECTORY_SEPARATOR . "$name-web-$ver.zip";
@unlink($zipFile);
$zip = new ZipArchive();
if ($zip->open($zipFile, ZipArchive::CREATE) !== true) out(500, ['ok' => false, 'error' => 'impossibile creare lo zip']);

$count = 0;
$add = function ($rel) use (&$add, $zip, $rootDir, $name, $isExcluded, &$count, $cfg) {
    $abs = $rootDir . DIRECTORY_SEPARATOR . $rel;
    $base = basename($rel);
    if ($base[0] === '.' || $isExcluded($base)) return;
    if (is_dir($abs)) {
        foreach (scandir($abs) as $e) if ($e !== '.' && $e !== '..') $add($rel . '/' . $e);
        return;
    }
    if (!is_file($abs)) return;
    if ($rel === 'data/config.json' && !empty($cfg['releaseConfig'])) {
        $game = json_decode(file_get_contents($abs), true) ?: [];
        $zip->addFromString("$name/$rel", json_encode(array_merge($game, $cfg['releaseConfig']), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
    } else {
        $zip->addFile($abs, "$name/$rel");
    }
    $count++;
};
foreach ($cfg['include'] ?? [] as $entry) $add($entry);
$zip->addFromString("$name/LEGGIMI.txt", ($cfg['name'] ?? $name) . " $ver — versione web\n\nCarica il contenuto della cartella su un server web e apri index.html.\nSui telefoni si installa dal browser: \"Aggiungi a schermata Home\".\n");
$zip->close();
out(200, ['ok' => true, 'job' => null, 'files' => ["dist/$name-web-$ver.zip"], 'count' => $count]);
