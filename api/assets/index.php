<?php
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$rootDir = realpath(__DIR__ . '/../../');

if ($rootDir === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'invalid root directory']);
    exit;
}

// ── Type config ───────────────────────────────────────────────────────────────
$TYPE_CONFIG = [
    'background' => [
        'dir'      => $rootDir . '/assets/images/background',
        'prefix'   => 'assets/images/background/',
        'exts'     => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
    ],
    'foreground' => [
        'dir'      => $rootDir . '/assets/images/foreground',
        'prefix'   => 'assets/images/foreground/',
        'exts'     => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
    ],
    'music' => [
        'dir'      => $rootDir . '/assets/music',
        'prefix'   => 'assets/music/',
        'exts'     => ['mp3', 'ogg', 'wav', 'm4a', 'aac'],
    ],
];

// ── Helper: collect all text content from data files used to detect "used" assets ──
function collectDataText(string $rootDir): string {
    $text = '';

    // Level files
    $levelDir = $rootDir . '/data/level';
    if (is_dir($levelDir)) {
        foreach (scandir($levelDir) as $f) {
            if (substr($f, -5) === '.json') {
                $c = @file_get_contents($levelDir . '/' . $f);
                if ($c !== false) $text .= $c;
            }
        }
    }

    // Manifest files
    $manifests = [
        '/data/background-images.json',
        '/data/foreground-images.json',
        '/data/music-files.json',
        '/data/data.json',
    ];
    foreach ($manifests as $m) {
        $c = @file_get_contents($rootDir . $m);
        if ($c !== false) $text .= $c;
    }

    return $text;
}

// ── GET ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $type = isset($_GET['type']) ? trim($_GET['type']) : '';

    if (!isset($TYPE_CONFIG[$type])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid type; expected background, foreground or music']);
        exit;
    }

    $cfg    = $TYPE_CONFIG[$type];
    $dir    = $cfg['dir'];
    $prefix = $cfg['prefix'];
    $exts   = $cfg['exts'];

    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0755, true)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'cannot create asset directory']);
            exit;
        }
    }

    $dataText = collectDataText($rootDir);

    $assets = [];
    $entries = scandir($dir);
    if ($entries !== false) {
        foreach ($entries as $name) {
            if ($name === '.' || $name === '..') continue;
            $fullPath = $dir . '/' . $name;
            if (!is_file($fullPath)) continue;
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            if (!in_array($ext, $exts, true)) continue;

            $assetPath = $prefix . $name;
            $assets[] = [
                'name' => $name,
                'path' => $assetPath,
                'used' => strpos($dataText, $assetPath) !== false,
            ];
        }
    }

    usort($assets, fn($a, $b) => strnatcasecmp($a['name'], $b['name']));
    echo json_encode(['ok' => true, 'assets' => $assets]);
    exit;
}

// ── DELETE ───────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody ?? '', true);

    if (json_last_error() !== JSON_ERROR_NONE || !is_array($payload)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid json body']);
        exit;
    }

    $type     = isset($payload['type'])     ? trim((string) $payload['type'])     : '';
    $fileName = isset($payload['fileName']) ? trim((string) $payload['fileName']) : '';

    if (!isset($TYPE_CONFIG[$type])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid type']);
        exit;
    }

    // Only allow safe file names (no path traversal)
    if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $fileName) || strpos($fileName, '..') !== false) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid file name']);
        exit;
    }

    $cfg      = $TYPE_CONFIG[$type];
    $filePath = $cfg['dir'] . '/' . $fileName;

    if (!is_file($filePath)) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'file not found']);
        exit;
    }

    // Refuse deletion if the asset is still referenced
    $assetPath = $cfg['prefix'] . $fileName;
    $dataText  = collectDataText($rootDir);
    if (strpos($dataText, $assetPath) !== false) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => 'asset is still in use and cannot be deleted']);
        exit;
    }

    if (!@unlink($filePath)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to delete file']);
        exit;
    }

    echo json_encode(['ok' => true, 'name' => $fileName]);
    exit;
}

// ── Other methods ─────────────────────────────────────────────────────────────
http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'method not allowed']);
