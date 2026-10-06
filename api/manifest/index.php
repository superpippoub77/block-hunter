<?php
// Game manifest (game.manifest.json): blocks, screens and scene flow (same API as server.js)
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$rootDir = realpath(__DIR__ . '/../../');
$file = $rootDir . DIRECTORY_SEPARATOR . 'game.manifest.json';

function out($code, $payload) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'GET') {
    $raw = @file_get_contents($file);
    if ($raw === false) out(404, ['ok' => false, 'error' => 'manifest not found']);
    $data = json_decode($raw);
    if (json_last_error() !== JSON_ERROR_NONE) out(500, ['ok' => false, 'error' => 'invalid manifest json']);
    out(200, ['ok' => true, 'data' => $data]);
}

if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '', false);
    if (!is_object($payload) || !isset($payload->data) || !is_object($payload->data)) out(400, ['ok' => false, 'error' => 'manifest must be an object']);
    $bck = $rootDir . DIRECTORY_SEPARATOR . 'bck';
    if (!is_dir($bck)) @mkdir($bck, 0755, true);
    if (is_file($file)) @copy($file, $bck . DIRECTORY_SEPARATOR . 'manifest-' . date('Ymd-His') . '.json');
    $json = json_encode($payload->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $json = preg_replace_callback('/^(?: {4})+/m', function ($m) { return str_repeat(' ', strlen($m[0]) / 2); }, $json);
    if ($json === false || @file_put_contents($file, $json . "\n") === false) out(500, ['ok' => false, 'error' => 'unable to write file']);
    out(200, ['ok' => true]);
}

out(405, ['ok' => false, 'error' => 'method not allowed']);
