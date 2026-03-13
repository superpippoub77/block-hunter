<?php
header('Content-Type: application/json; charset=utf-8');

function send_json($status, $payload) {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function sanitize_filename($name) {
    $base = basename((string)$name);
    if ($base === '' || $base === '.' || $base === '..') {
        return '';
    }
    if (!preg_match('/^[A-Za-z0-9._-]+$/', $base)) {
        return '';
    }
    return $base;
}

function get_json_body() {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

$rootDir = realpath(__DIR__ . '/../../../');
$imagesDir = $rootDir . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'images' . DIRECTORY_SEPARATOR . 'scenes' . DIRECTORY_SEPARATOR . 'game' . DIRECTORY_SEPARATOR . 'foreground';

if ($rootDir === false) {
    send_json(500, ['ok' => false, 'error' => 'invalid root dir']);
}

$allowedExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!is_dir($imagesDir)) {
        echo json_encode([]);
        exit;
    }

    $list = [];
    $entries = scandir($imagesDir);
    if ($entries !== false) {
        foreach ($entries as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }

            $fullPath = $imagesDir . DIRECTORY_SEPARATOR . $name;
            if (!is_file($fullPath)) {
                continue;
            }

            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExt, true)) {
                continue;
            }

            $list[] = 'assets/images/scenes/game/foreground/' . $name;
        }
    }

    sort($list, SORT_NATURAL | SORT_FLAG_CASE);
    echo json_encode($list);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = get_json_body();
    if ($body === null) {
        send_json(400, ['ok' => false, 'error' => 'invalid json']);
    }

    $action = strtolower(trim((string)($body['action'] ?? '')));
    if ($action === 'rename') {
        $oldName = sanitize_filename($body['oldName'] ?? '');
        $newName = sanitize_filename($body['newName'] ?? '');
        if ($oldName === '' || $newName === '') {
            send_json(400, ['ok' => false, 'error' => 'invalid oldName/newName']);
        }

        $oldExt = strtolower(pathinfo($oldName, PATHINFO_EXTENSION));
        $newExt = strtolower(pathinfo($newName, PATHINFO_EXTENSION));
        if (!in_array($oldExt, $allowedExt, true) || !in_array($newExt, $allowedExt, true)) {
            send_json(400, ['ok' => false, 'error' => 'unsupported file extension']);
        }

        if (!is_dir($imagesDir)) {
            @mkdir($imagesDir, 0775, true);
        }

        $oldPath = $imagesDir . DIRECTORY_SEPARATOR . $oldName;
        $newPath = $imagesDir . DIRECTORY_SEPARATOR . $newName;
        if (!file_exists($oldPath)) {
            send_json(404, ['ok' => false, 'error' => 'file not found']);
        }
        if (!@rename($oldPath, $newPath)) {
            send_json(500, ['ok' => false, 'error' => 'cannot rename file']);
        }

        send_json(200, [
            'ok' => true,
            'oldFile' => 'assets/images/scenes/game/foreground/' . $oldName,
            'file' => 'assets/images/scenes/game/foreground/' . $newName
        ]);
    }

    $fileName = sanitize_filename($body['fileName'] ?? '');
    $contentBase64 = trim((string)($body['contentBase64'] ?? ''));
    if ($fileName === '' || $contentBase64 === '') {
        send_json(400, ['ok' => false, 'error' => 'missing fileName or contentBase64']);
    }

    $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) {
        send_json(400, ['ok' => false, 'error' => 'unsupported file extension']);
    }

    $decoded = base64_decode($contentBase64, true);
    if ($decoded === false || $decoded === '') {
        send_json(400, ['ok' => false, 'error' => 'invalid base64 payload']);
    }

    if (!is_dir($imagesDir)) {
        @mkdir($imagesDir, 0775, true);
    }

    $target = $imagesDir . DIRECTORY_SEPARATOR . $fileName;
    if (file_put_contents($target, $decoded) === false) {
        send_json(500, ['ok' => false, 'error' => 'cannot write file']);
    }

    send_json(200, ['ok' => true, 'file' => 'assets/images/scenes/game/foreground/' . $fileName]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $fileName = sanitize_filename($_GET['file'] ?? '');
    if ($fileName === '') {
        send_json(400, ['ok' => false, 'error' => 'missing file']);
    }

    $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) {
        send_json(400, ['ok' => false, 'error' => 'unsupported file extension']);
    }

    $target = $imagesDir . DIRECTORY_SEPARATOR . $fileName;
    if (!file_exists($target)) {
        send_json(404, ['ok' => false, 'error' => 'file not found']);
    }
    if (!is_file($target) || !unlink($target)) {
        send_json(500, ['ok' => false, 'error' => 'cannot delete file']);
    }

    send_json(200, ['ok' => true, 'file' => 'assets/images/scenes/game/foreground/' . $fileName]);
}

send_json(405, ['ok' => false, 'error' => 'method not allowed']);
