<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

set_cors();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = rtrim($path ?? '/', '/');
if ($path === '') {
    $path = '/';
}

$pdo = db();

if ($path === '/api/health-id/verification-request' && $method === 'POST') {
    $payload = require_auth();
    $userId = (string) $payload['sub'];
    $body = parse_json_body();
    $hospitalId = trim((string) ($body['hospital_id'] ?? ''));
    $requestNote = isset($body['request_note']) ? trim((string) $body['request_note']) : null;

    if ($hospitalId === '') {
        json_response(400, ['success' => false, 'error' => 'hospital_id is required']);
    }

    $dup = $pdo->prepare('SELECT id FROM health_id_verification_requests WHERE user_id = ? AND hospital_id = ? AND status = ? LIMIT 1');
    $dup->execute([$userId, $hospitalId, 'pending']);
    if ($dup->fetch()) {
        json_response(409, ['success' => false, 'error' => 'A pending request already exists for this hospital']);
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO health_id_verification_requests (user_id, hospital_id, status, request_note, created_at, updated_at)
             VALUES (?, ?, ?, ?, NOW(), NOW())'
        );
        $stmt->execute([$userId, $hospitalId, 'pending', $requestNote]);
        $requestId = (int) $pdo->lastInsertId();

        $healthId = null;
        $userRow = get_user_record($pdo, $userId);
        if ($userRow) {
            $healthId = $userRow['health_id'] ?? null;
        }
        if (!$healthId) {
            $healthId = 'NG-' . strtoupper(substr($userId, 0, 8));
            $updateHealth = $pdo->prepare('UPDATE users SET health_id = ? WHERE id = ?');
            $updateHealth->execute([$healthId, $userId]);
        }

        $updateUser = $pdo->prepare(
            'UPDATE users SET health_id_verification_status = ?, health_id_verified_by_hospital_id = NULL, health_id_verified_at = NULL WHERE id = ?'
        );
        $updateUser->execute(['pending', $userId]);

        $userInfoStmt = $pdo->prepare(
            'SELECT COALESCE(p.full_name, "User") AS full_name FROM user_profiles p WHERE p.user_id = ? LIMIT 1'
        );
        $userInfoStmt->execute([$userId]);
        $userInfo = $userInfoStmt->fetch();
        $userName = $userInfo['full_name'] ?? 'User';

        $hospitalUsersStmt = $pdo->prepare(
            'SELECT id FROM users WHERE role = ? AND hospital_id = ?'
        );
        $hospitalUsersStmt->execute(['hospital', $hospitalId]);
        $hospitalUsers = $hospitalUsersStmt->fetchAll();

        $notifStmt = $pdo->prepare(
            'INSERT INTO notifications (id, recipient_user_id, actor_user_id, type, payload_json, is_read, created_at, user_id, notification_type, title, message)
             VALUES (?, ?, ?, ?, ?, 0, NOW(), ?, ?, ?, ?)'
        );

        foreach ($hospitalUsers as $hospitalUser) {
            $notifId = bin2hex(random_bytes(16));
            $payloadJson = json_encode([
                'request_id' => $requestId,
                'user_id' => $userId,
                'health_id' => $healthId,
                'user_name' => $userName,
                'hospital_id' => $hospitalId
            ]);

            $notifStmt->execute([
                $notifId,
                $hospitalUser['id'],
                $userId,
                'health_id_verification_request',
                $payloadJson,
                $hospitalUser['id'],
                'health_id_verification_request',
                'Health ID Verification Request',
                "{$userName} requested Health ID verification.",
            ]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_response(500, ['success' => false, 'error' => 'Failed to create verification request']);
    }

    json_response(200, [
        'success' => true,
        'data' => [
            'request_id' => $requestId,
            'status' => 'pending'
        ]
    ]);
}

if ($path === '/api/health-id/verification-status' && $method === 'GET') {
    $payload = require_auth();
    $userId = (string) $payload['sub'];
    $stmt = $pdo->prepare('SELECT health_id, health_id_verification_status FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    $healthId = $row['health_id'] ?? ('NG-' . strtoupper(substr($userId, 0, 8)));
    $status = $row['health_id_verification_status'] ?? 'unverified';

    json_response(200, [
        'success' => true,
        'data' => [
            'health_id' => $healthId,
            'status' => $status
        ]
    ]);
}

if ($path === '/api/hospital/verification-requests' && $method === 'GET') {
    $payload = require_auth();
    $userId = (string) $payload['sub'];
    $hospitalUser = require_hospital($pdo, $userId);
    $hospitalId = $hospitalUser['hospital_id'];

    $stmt = $pdo->prepare(
        'SELECT r.id,
                r.user_id,
                r.hospital_id,
                r.status,
                r.request_note,
                r.rejection_reason,
                r.created_at,
                r.updated_at,
                COALESCE(u.health_id, CONCAT("NG-", UPPER(SUBSTRING(u.id, 1, 8)))) AS health_id,
                COALESCE(p.full_name, "User") AS user_name,
                COALESCE(a.city, a.state, "") AS area
         FROM health_id_verification_requests r
         INNER JOIN users u ON u.id = r.user_id
         LEFT JOIN user_profiles p ON p.user_id = r.user_id
         LEFT JOIN addresses a ON a.user_id = r.user_id AND a.is_primary = 1
         WHERE r.hospital_id = ? AND r.status = ?
         ORDER BY r.created_at DESC'
    );
    $stmt->execute([$hospitalId, 'pending']);
    $items = $stmt->fetchAll();

    json_response(200, ['success' => true, 'items' => $items]);
}

if (preg_match('#^/api/hospital/verification-requests/(\\d+)/decision$#', $path, $matches) && $method === 'POST') {
    $payload = require_auth();
    $userId = (string) $payload['sub'];
    $hospitalUser = require_hospital($pdo, $userId);
    $hospitalId = $hospitalUser['hospital_id'];

    $requestId = (int) $matches[1];
    $body = parse_json_body();
    $decision = trim((string) ($body['decision'] ?? ''));
    $rejectionReason = isset($body['rejection_reason']) ? trim((string) $body['rejection_reason']) : null;

    if (!in_array($decision, ['accepted', 'rejected'], true)) {
        json_response(400, ['success' => false, 'error' => 'decision must be accepted or rejected']);
    }

    $pdo->beginTransaction();
    try {
        $select = $pdo->prepare(
            'SELECT id, user_id, hospital_id, status FROM health_id_verification_requests WHERE id = ? LIMIT 1'
        );
        $select->execute([$requestId]);
        $request = $select->fetch();
        if (!$request) {
            $pdo->rollBack();
            json_response(404, ['success' => false, 'error' => 'Request not found']);
        }
        if ($request['hospital_id'] !== $hospitalId) {
            $pdo->rollBack();
            json_response(403, ['success' => false, 'error' => 'Not authorized for this request']);
        }

        $updateRequest = $pdo->prepare(
            'UPDATE health_id_verification_requests SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?'
        );
        $updateRequest->execute([$decision, $decision === 'rejected' ? $rejectionReason : null, $requestId]);

        if ($decision === 'accepted') {
            $updateUser = $pdo->prepare(
                'UPDATE users SET health_id_verification_status = ?, health_id_verified_by_hospital_id = ?, health_id_verified_at = NOW() WHERE id = ?'
            );
            $updateUser->execute(['accepted', $hospitalId, $request['user_id']]);
        } else {
            $updateUser = $pdo->prepare(
                'UPDATE users SET health_id_verification_status = ?, health_id_verified_by_hospital_id = NULL, health_id_verified_at = NULL WHERE id = ?'
            );
            $updateUser->execute(['rejected', $request['user_id']]);
        }

        $hospitalNameStmt = $pdo->prepare('SELECT name FROM app_catalog WHERE type = ? AND id = ? LIMIT 1');
        $hospitalNameStmt->execute(['hospital', $hospitalId]);
        $hospitalRow = $hospitalNameStmt->fetch();
        $hospitalName = $hospitalRow['name'] ?? 'Hospital';

        $notifId = bin2hex(random_bytes(16));
        $payloadJson = json_encode([
            'request_id' => $requestId,
            'hospital_id' => $hospitalId,
            'hospital_name' => $hospitalName,
            'status' => $decision,
            'rejection_reason' => $decision === 'rejected' ? $rejectionReason : null
        ]);

        $notifType = $decision === 'accepted'
            ? 'health_id_verification_accepted'
            : 'health_id_verification_rejected';

        $notifTitle = $decision === 'accepted'
            ? 'Health ID Verified'
            : 'Health ID Verification Rejected';

        $notifMessage = $decision === 'accepted'
            ? "{$hospitalName} accepted your Health ID verification request."
            : "{$hospitalName} rejected your Health ID verification request.";

        $notifStmt = $pdo->prepare(
            'INSERT INTO notifications (id, recipient_user_id, actor_user_id, type, payload_json, is_read, created_at, user_id, notification_type, title, message)
             VALUES (?, ?, ?, ?, ?, 0, NOW(), ?, ?, ?, ?)'
        );
        $notifStmt->execute([
            $notifId,
            $request['user_id'],
            $userId,
            $notifType,
            $payloadJson,
            $request['user_id'],
            $notifType,
            $notifTitle,
            $notifMessage
        ]);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_response(500, ['success' => false, 'error' => 'Failed to update request']);
    }

    json_response(200, ['success' => true, 'data' => ['status' => $decision]]);
}

if ($path === '/api/notifications' && $method === 'GET') {
    $payload = require_auth();
    $userId = (string) $payload['sub'];

    $items = [];

    $stmt = $pdo->prepare(
        'SELECT id,
                user_id,
                notification_type,
                title,
                message,
                is_read,
                created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC'
    );
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll();
    foreach ($rows as $row) {
        $items[] = [
            'id' => (string) $row['id'],
            'userId' => $userId,
            'type' => $row['notification_type'] ?: 'SYSTEM',
            'title' => $row['title'] ?: 'Notification',
            'message' => $row['message'] ?: '',
            'link' => '/profile',
            'isRead' => (bool) $row['is_read'],
            'createdAt' => $row['created_at']
        ];
    }

    $entityStmt = $pdo->prepare(
        'SELECT id, data, created_at FROM app_entities WHERE type = ? AND user_id = ? ORDER BY created_at DESC'
    );
    $entityStmt->execute(['notification', $userId]);
    $entityRows = $entityStmt->fetchAll();
    foreach ($entityRows as $row) {
        $data = json_decode($row['data'] ?? '{}', true);
        if (!is_array($data)) {
            $data = [];
        }
        $items[] = [
            'id' => (string) ($data['id'] ?? $row['id']),
            'userId' => $userId,
            'type' => $data['type'] ?? 'SYSTEM',
            'title' => $data['title'] ?? 'Notification',
            'message' => $data['message'] ?? '',
            'link' => $data['link'] ?? null,
            'isRead' => (bool) ($data['isRead'] ?? false),
            'createdAt' => $data['createdAt'] ?? $row['created_at']
        ];
    }

    usort($items, function (array $a, array $b): int {
        return strtotime((string) $b['createdAt']) <=> strtotime((string) $a['createdAt']);
    });

    json_response(200, ['items' => $items]);
}

if (preg_match('#^/api/notifications/([A-Za-z0-9\\-]+)$#', $path, $matches) && $method === 'PATCH') {
    $payload = require_auth();
    $userId = (string) $payload['sub'];
    $notifId = $matches[1];

    $updated = false;

    $stmt = $pdo->prepare(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND COALESCE(recipient_user_id, user_id) = ?'
    );
    $stmt->execute([$notifId, $userId]);
    if ($stmt->rowCount() > 0) {
        $updated = true;
    }

    if (!$updated) {
        $select = $pdo->prepare('SELECT id, data FROM app_entities WHERE id = ? AND type = ? AND user_id = ? LIMIT 1');
        $select->execute([$notifId, 'notification', $userId]);
        $row = $select->fetch();
        if ($row) {
            $data = json_decode($row['data'] ?? '{}', true);
            if (!is_array($data)) {
                $data = [];
            }
            $data['isRead'] = true;
            $update = $pdo->prepare('UPDATE app_entities SET data = ?, updated_at = NOW() WHERE id = ?');
            $update->execute([json_encode($data), $notifId]);
            $updated = true;
        }
    }

    json_response(200, ['success' => true, 'updated' => $updated]);
}

if ($path === '/api/notifications/mark-all' && $method === 'POST') {
    $payload = require_auth();
    $userId = (string) $payload['sub'];

    $stmt = $pdo->prepare(
        'UPDATE notifications SET is_read = 1 WHERE COALESCE(recipient_user_id, user_id) = ?'
    );
    $stmt->execute([$userId]);

    $select = $pdo->prepare('SELECT id, data FROM app_entities WHERE type = ? AND user_id = ?');
    $select->execute(['notification', $userId]);
    $rows = $select->fetchAll();
    foreach ($rows as $row) {
        $data = json_decode($row['data'] ?? '{}', true);
        if (!is_array($data)) {
            $data = [];
        }
        $data['isRead'] = true;
        $update = $pdo->prepare('UPDATE app_entities SET data = ?, updated_at = NOW() WHERE id = ?');
        $update->execute([json_encode($data), $row['id']]);
    }

    json_response(200, ['success' => true]);
}

json_response(404, ['success' => false, 'error' => 'Not found']);
