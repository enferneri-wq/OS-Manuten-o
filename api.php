<?php
/**
 * ALVS ENGINEERING & MEDICAL - API BACKEND (HOSTINGER)
 */

error_reporting(0);
ini_set('display_errors', 0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

$host = 'localhost';
$dbname = 'u123456789_clineng'; 
$user = 'u123456789_admin';
$pass = 'SUA_SENHA_AQUI';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    if ($_SERVER['REQUEST_METHOD'] !== 'OPTIONS') {
        http_response_code(500);
        echo json_encode(['error' => 'Connection failed']);
    }
    exit;
}

$action = $_GET['action'] ?? '';
ob_start();

switch ($action) {
    case 'get_all':
        $stmt = $pdo->query("SELECT * FROM equipments ORDER BY created_at DESC");
        $equipments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($equipments as &$equip) {
            $stmtS = $pdo->prepare("SELECT * FROM service_records WHERE equipment_id = ? ORDER BY date DESC");
            $stmtS->execute([$equip['id']]);
            $equip['serviceRecords'] = $stmtS->fetchAll(PDO::FETCH_ASSOC);
        }
        $output = json_encode($equipments);
        break;

    case 'get_customers':
        $stmt = $pdo->query("SELECT * FROM customers ORDER BY name ASC");
        $output = json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        break;

    case 'add_customer':
        $data = json_decode(file_get_contents("php://input"), true);
        if ($data) {
            $stmt = $pdo->prepare("INSERT INTO customers (id, name, tax_id, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$data['id'], $data['name'], $data['taxId'], $data['email'], $data['phone'], $data['address']]);
            $output = json_encode(['success' => true]);
        }
        break;

    case 'add_equipment':
        $data = json_decode(file_get_contents("php://input"), true);
        if ($data) {
            $stmt = $pdo->prepare("INSERT INTO equipments (id, code, name, brand, model, manufacturer, serial_number, entry_date, observations, status, customer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $data['id'], $data['code'], $data['name'], $data['brand'], 
                $data['model'], $data['manufacturer'], $data['serialNumber'], 
                $data['entryDate'], $data['observations'], $data['status'], $data['customerId']
            ]);
            $output = json_encode(['success' => true]);
        }
        break;

    case 'add_service':
        $data = json_decode(file_get_contents("php://input"), true);
        if ($data) {
            $pdo->beginTransaction();
            try {
                $stmtS = $pdo->prepare("INSERT INTO service_records (id, equipment_id, date, description, technician_id) VALUES (?, ?, ?, ?, ?)");
                $stmtS->execute([$data['id'], $data['equipmentId'], $data['date'], $data['description'], $data['technicianId']]);
                $stmtU = $pdo->prepare("UPDATE equipments SET status = ? WHERE id = ?");
                $stmtU->execute([$data['newStatus'], $data['equipmentId']]);
                $pdo->commit();
                $output = json_encode(['success' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                $output = json_encode(['error' => $e->getMessage()]);
            }
        }
        break;

    default:
        $output = json_encode(['message' => 'API Online']);
        break;
}

$content = ob_get_clean();
echo $output;
exit;