<?php
/**
 * ALVS ENGINEERING & MEDICAL - API BACKEND (HOSTINGER)
 * Configure as credenciais do seu banco de dados abaixo no phpMyAdmin da Hostinger.
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// CONFIGURAÇÃO DO BANCO (Substitua pelos dados da sua Hostinger)
$host = 'localhost';
$dbname = 'u123456789_clineng'; 
$user = 'u123456789_admin';
$pass = 'SUA_SENHA_AQUI';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    // Retorna erro se a conexão falhar (importante para depuração na Hostinger)
    if ($_SERVER['REQUEST_METHOD'] !== 'OPTIONS') {
        echo json_encode(['error' => 'Connection failed: ' . $e->getMessage()]);
    }
    exit;
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get_all':
        // Busca todos os equipamentos e seus registros de serviço
        $stmt = $pdo->query("SELECT * FROM equipments ORDER BY created_at DESC");
        $equipments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($equipments as &$equip) {
            $stmtS = $pdo->prepare("SELECT * FROM service_records WHERE equipment_id = ? ORDER BY date DESC");
            $stmtS->execute([$equip['id']]);
            $equip['serviceRecords'] = $stmtS->fetchAll(PDO::FETCH_ASSOC);
        }
        echo json_encode($equipments);
        break;

    case 'add_equipment':
        $data = json_decode(file_get_contents("php://input"), true);
        $stmt = $pdo->prepare("INSERT INTO equipments (id, code, name, brand, model, manufacturer, serial_number, entry_date, observations, status, customer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $data['id'], $data['code'], $data['name'], $data['brand'], 
            $data['model'], $data['manufacturer'], $data['serialNumber'], 
            $data['entryDate'], $data['observations'], $data['status'], $data['customerId']
        ]);
        echo json_encode(['success' => true]);
        break;

    case 'add_service':
        $data = json_decode(file_get_contents("php://input"), true);
        
        // Inicia transação para atualizar o status do equipamento e inserir o registro
        $pdo->beginTransaction();
        try {
            $stmtS = $pdo->prepare("INSERT INTO service_records (id, equipment_id, date, description, technician_id) VALUES (?, ?, ?, ?, ?)");
            $stmtS->execute([$data['id'], $data['equipmentId'], $data['date'], $data['description'], $data['technicianId']]);
            
            $stmtU = $pdo->prepare("UPDATE equipments SET status = ? WHERE id = ?");
            $stmtU->execute([$data['newStatus'], $data['equipmentId']]);
            
            $pdo->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(['error' => $e->getMessage()]);
        }
        break;

    default:
        if ($_SERVER['REQUEST_METHOD'] !== 'OPTIONS') {
            echo json_encode(['message' => 'ALVS API Online']);
        }
        break;
}
?>