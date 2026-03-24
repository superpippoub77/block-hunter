<?php
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$rootDir = realpath(__DIR__ . '/../../');

if ($rootDir === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'invalid root directory']);
    exit;
}

$dicDir = $rootDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'dic';

if (!is_dir($dicDir)) {
    if (!@mkdir($dicDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'cannot create dic directory']);
        exit;
    }
}

// ── GET ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $name = isset($_GET['name']) ? trim($_GET['name']) : '';

    // Single dictionary
    if ($name !== '') {
        // Validate: only alphanumeric + dash/underscore, must end in .json
        if (!preg_match('/^[a-zA-Z0-9_\-]+\.json$/', $name)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid file name']);
            exit;
        }

        $filePath = $dicDir . DIRECTORY_SEPARATOR . $name;

        if (!is_file($filePath)) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'dictionary not found']);
            exit;
        }

        $raw = @file_get_contents($filePath);
        if ($raw === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'unable to read file']);
            exit;
        }

        $parsed = json_decode($raw, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $parsed = [];
        }

        echo json_encode(['ok' => true, 'data' => $parsed]);
        exit;
    }

    // List all dictionaries
    $items = [];
    $entries = scandir($dicDir);
    if ($entries !== false) {
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $fullPath = $dicDir . DIRECTORY_SEPARATOR . $entry;
            if (!is_file($fullPath)) continue;
            if (strtolower(pathinfo($entry, PATHINFO_EXTENSION)) !== 'json') continue;
            $items[] = $entry;
        }
    }
    sort($items, SORT_NATURAL | SORT_FLAG_CASE);
    echo json_encode(['ok' => true, 'items' => $items]);
    exit;
}

// ── POST ─────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody ?? '', true);

    if (json_last_error() !== JSON_ERROR_NONE || !is_array($payload)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid json body']);
        exit;
    }

    $name = isset($payload['name']) ? trim((string) $payload['name']) : '';
    $data = isset($payload['data']) ? $payload['data'] : null;

    if (!preg_match('/^[a-zA-Z0-9_\-]+\.json$/', $name)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid file name']);
        exit;
    }

    if (!is_array($data) && !is_object($data)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'data must be a JSON object']);
        exit;
    }

    $filePath = $dicDir . DIRECTORY_SEPARATOR . $name;
    $encoded  = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    if ($encoded === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'json encoding failed']);
        exit;
    }

    if (file_put_contents($filePath, $encoded) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to write file']);
        exit;
    }

    echo json_encode(['ok' => true, 'name' => $name]);
    exit;
}

// ── Other methods ─────────────────────────────────────────────────────────────
http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'method not allowed']);
