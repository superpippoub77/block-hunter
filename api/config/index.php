<?php
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$rootDir = realpath(__DIR__ . '/../../');

if ($rootDir === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'invalid root directory']);
    exit;
}

$configFile = $rootDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'config.json';
$backupDir = $rootDir . DIRECTORY_SEPARATOR . 'bck';

if ($method === 'GET') {
    if (!is_file($configFile)) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'config file not found']);
        exit;
    }

    $data = @file_get_contents($configFile);
    if ($data === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to read config file']);
        exit;
    }

    $parsed = json_decode($data, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($parsed)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'invalid config json']);
        exit;
    }

    echo json_encode($parsed);
    exit;
}

if ($method === 'POST') {
    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody ?? '', true);

    if (json_last_error() !== JSON_ERROR_NONE || !is_array($payload)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid json']);
        exit;
    }

    // Reject non-object JSON payloads (e.g. array)
    if (array_keys($payload) === range(0, count($payload) - 1)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'payload must be an object']);
        exit;
    }

    if (!is_dir($backupDir) && !@mkdir($backupDir, 0775, true)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to create backup directory']);
        exit;
    }

    if (!is_dir(dirname($configFile)) && !@mkdir(dirname($configFile), 0775, true)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to create config directory']);
        exit;
    }

    $currentConfig = '{}';
    if (is_file($configFile)) {
        $existing = @file_get_contents($configFile);
        if ($existing !== false && $existing !== '') {
            $currentConfig = $existing;
        }
    }

    $stamp = date('Ymd-His');
    $backupFileName = 'config-' . $stamp . '.json';
    $backupFilePath = $backupDir . DIRECTORY_SEPARATOR . $backupFileName;

    $suffix = 1;
    while (is_file($backupFilePath)) {
        $backupFileName = 'config-' . $stamp . '-' . $suffix . '.json';
        $backupFilePath = $backupDir . DIRECTORY_SEPARATOR . $backupFileName;
        $suffix++;
    }

    if (@file_put_contents($backupFilePath, $currentConfig) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to write backup file']);
        exit;
    }

    $encoded = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to encode config json']);
        exit;
    }

    if (@file_put_contents($configFile, $encoded . PHP_EOL) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to write config file']);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'backupFile' => 'bck/' . $backupFileName
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'method not allowed']);
