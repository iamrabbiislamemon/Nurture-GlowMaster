<?php
declare(strict_types=1);

function load_env_file(string $path): array {
    if (!is_file($path)) {
        return [];
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return [];
    }

    $env = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        $parts = explode('=', $line, 2);
        if (count($parts) !== 2) {
            continue;
        }
        $key = trim($parts[0]);
        $value = trim($parts[1]);
        if ($value !== '' && $value[0] === '"' && substr($value, -1) === '"') {
            $value = substr($value, 1, -1);
        }
        $env[$key] = $value;
    }

    return $env;
}

$envFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
$envValues = load_env_file($envFile);
foreach ($envValues as $key => $value) {
    if (!isset($_ENV[$key])) {
        $_ENV[$key] = $value;
    }
}

function env_value(string $key, ?string $default = null): ?string {
    return $_ENV[$key] ?? $default;
}

function json_response(int $status, array $payload): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($payload);
    exit;
}

function parse_json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function base64url_decode(string $data): string {
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/')) ?: '';
}

function verify_jwt(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }
    [$header64, $payload64, $sig64] = $parts;
    $header = json_decode(base64url_decode($header64), true);
    if (!is_array($header) || ($header['alg'] ?? '') !== 'HS256') {
        return null;
    }
    $payload = json_decode(base64url_decode($payload64), true);
    if (!is_array($payload)) {
        return null;
    }
    $expected = hash_hmac('sha256', $header64 . '.' . $payload64, $secret, true);
    $sig = base64url_decode($sig64);
    if (!hash_equals($expected, $sig)) {
        return null;
    }
    if (isset($payload['exp']) && time() >= (int) $payload['exp']) {
        return null;
    }
    return $payload;
}

function require_auth(): array {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\\s+(.*)$/i', $auth, $matches)) {
        json_response(401, ['success' => false, 'error' => 'Missing token']);
    }
    $token = trim($matches[1]);
    $secret = env_value('JWT_SECRET', '');
    if ($secret === '') {
        json_response(500, ['success' => false, 'error' => 'JWT secret not configured']);
    }
    $payload = verify_jwt($token, $secret);
    if (!$payload || empty($payload['sub'])) {
        json_response(401, ['success' => false, 'error' => 'Invalid token']);
    }
    return $payload;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $host = env_value('DB_HOST', 'localhost');
    $port = env_value('DB_PORT', '3306');
    $name = env_value('DB_NAME', '');
    $user = env_value('DB_USER', 'root');
    $pass = env_value('DB_PASSWORD', '');
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    return $pdo;
}

function get_user_record(PDO $pdo, string $userId): ?array {
    $stmt = $pdo->prepare('SELECT id, role, hospital_id, health_id, health_id_verification_status FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function require_hospital(PDO $pdo, string $userId): array {
    $user = get_user_record($pdo, $userId);
    if (!$user || ($user['role'] ?? '') !== 'hospital') {
        json_response(403, ['success' => false, 'error' => 'Hospital access required']);
    }
    if (empty($user['hospital_id'])) {
        json_response(403, ['success' => false, 'error' => 'Hospital account not linked']);
    }
    return $user;
}

function set_cors(): void {
    $origin = env_value('CORS_ORIGIN', '*');
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
    header('Access-Control-Allow-Credentials: true');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
