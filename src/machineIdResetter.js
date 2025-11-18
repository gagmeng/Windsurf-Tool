const { exec } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

// 日志回调函数（用于向前端发送日志）
let logCallback = null;

/**
 * 设置日志回调
 */
function setLogCallback(callback) {
  logCallback = callback;
}

/**
 * 输出日志（同时输出到控制台和回调）
 */
function log(message, type = 'info') {
  console.log(message);
  if (logCallback) {
    logCallback({ message, type });
  }
}

/**
 * 生成新的机器ID（统一使用 accountSwitcher 的逻辑）
 */
function generateMachineIds() {
  const platform = process.platform;
  
  return {
    // 1. 主机器ID (machineid 文件) - 标准 UUID 小写
    mainMachineId: uuidv4().toLowerCase(),
    
    // 2. 遥测机器ID (telemetry.machineId) - SHA256 哈希
    telemetryMachineId: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
    
    // 3. macOS 专用机器ID (telemetry.macMachineId) - SHA512 哈希
    macMachineId: platform === 'darwin' ? crypto.createHash('sha512').update(crypto.randomBytes(64)).digest('hex') : null,
    
    // 4. SQM ID (telemetry.sqmId) - UUID 大写带花括号
    sqmId: '{' + uuidv4().toUpperCase() + '}',
    
    // 5. 开发设备ID (telemetry.devDeviceId) - 标准 UUID
    devDeviceId: uuidv4().toLowerCase(),
    
    // 6. 服务机器ID (storage.serviceMachineId) - 标准 UUID
    serviceMachineId: uuidv4().toLowerCase()
  };
}

/**
 * 获取 Windsurf 用户数据路径
 * Windows: %APPDATA%\Windsurf (C:\Users\用户名\AppData\Roaming\Windsurf)
 * macOS: ~/Library/Application Support/Windsurf
 * Linux: ~/.config/Windsurf
 */
function getWindsurfUserDataPath() {
  const platform = process.platform;
  if (platform === 'win32') {
    // Windows 使用 APPDATA (Roaming)
    // 例如: C:\Users\Administrator\AppData\Roaming\Windsurf
    return path.join(process.env.APPDATA, 'Windsurf');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Windsurf');
  } else {
    return path.join(os.homedir(), '.config', 'Windsurf');
  }
}

/**
 * 检测 Windows 系统中 Windsurf 的安装路径
 */
async function detectWindsurfInstallPath() {
  const platform = process.platform;
  if (platform !== 'win32') {
    return null;
  }

  const username = os.userInfo().username;
  const possiblePaths = [
    // 标准安装路径
    `C:\\Users\\${username}\\AppData\\Local\\Programs\\Windsurf`,
    'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Windsurf',
    'C:\\Users\\admin\\AppData\\Local\\Programs\\Windsurf',
    // 其他盘符
    'D:\\Windsurf',
    'E:\\Windsurf',
    'F:\\Windsurf',
    'D:\\Programs\\Windsurf',
    'E:\\Programs\\Windsurf',
    'F:\\Programs\\Windsurf',
    'D:\\Program Files\\Windsurf',
    'E:\\Program Files\\Windsurf',
    'F:\\Program Files\\Windsurf'
  ];

  for (const installPath of possiblePaths) {
    try {
      const exePath = path.join(installPath, 'Windsurf.exe');
      await fs.access(exePath);
      log(`✅ 检测到 Windsurf 安装路径: ${installPath}`, 'success');
      return installPath;
    } catch (err) {
      // 路径不存在，继续检测
    }
  }

  log('⚠️ 未能自动检测到 Windsurf 安装路径', 'warning');
  return null;
}

/**
 * 获取 Windsurf 相关文件路径
 */
function getWindsurfPaths() {
  const userDataPath = getWindsurfUserDataPath();
  return {
    userDataPath,
    machineIdFile: path.join(userDataPath, 'machineid'),
    storageJson: path.join(userDataPath, 'User', 'globalStorage', 'storage.json'),
    stateDb: path.join(userDataPath, 'User', 'globalStorage', 'state.vscdb')
  };
}

/**
 * 检查 Windsurf 是否正在运行（使用 accountSwitcher 的逻辑）
 */
async function checkWindsurfRunning() {
  try {
    const { WindsurfPathDetector } = require(path.join(__dirname, '..', 'js', 'accountSwitcher'));
    return await WindsurfPathDetector.isRunning();
  } catch (error) {
    log(`检测运行状态失败: ${error.message}`, 'warning');
    return false;
  }
}

/**
 * 关闭 Windsurf 应用（使用 accountSwitcher 的成熟逻辑）
 */
async function closeWindsurf() {
  try {
    log('🔄 正在关闭 Windsurf 应用...', 'info');
    
    const { WindsurfPathDetector } = require(path.join(__dirname, '..', 'js', 'accountSwitcher'));
    await WindsurfPathDetector.closeWindsurf();
    
    log('✅ Windsurf 应用已关闭', 'success');
    return { success: true };
  } catch (error) {
    log(`❌ 关闭 Windsurf 失败: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * 更新 machineid 文件
 */
async function updateMachineIdFile(machineIdPath, machineId) {
  try {
    log('🔄 正在更新 machineid 文件...', 'info');
    await fs.mkdir(path.dirname(machineIdPath), { recursive: true });
    await fs.writeFile(machineIdPath, machineId, 'utf-8');
    log(`✅ machineid 文件已更新: ${machineId}`, 'success');
    return { success: true };
  } catch (error) {
    log(`❌ 更新 machineid 文件失败: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * 更新 storage.json
 */
async function updateStorageJson(storagePath, machineIds) {
  try {
    log('🔄 正在更新 storage.json...', 'info');
    
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    
    let storageData = {};
    try {
      const content = await fs.readFile(storagePath, 'utf-8');
      storageData = JSON.parse(content);
      log('✅ 已读取现有 storage.json', 'success');
    } catch (err) {
      log('ℹ️ 未找到现有 storage.json，将创建新文件', 'info');
    }
    
    // 更新机器 ID 字段
    storageData['telemetry.machineId'] = machineIds.telemetryMachineId;
    storageData['telemetry.sqmId'] = machineIds.sqmId;
    storageData['telemetry.devDeviceId'] = machineIds.devDeviceId;
    
    // macOS 特有字段
    if (machineIds.macMachineId) {
      storageData['telemetry.macMachineId'] = machineIds.macMachineId;
    }
    
    await fs.writeFile(storagePath, JSON.stringify(storageData, null, 2));
    
    log('✅ storage.json 已更新', 'success');
    log(`  - telemetry.machineId: ${machineIds.telemetryMachineId.substring(0, 16)}...`, 'info');
    log(`  - telemetry.sqmId: ${machineIds.sqmId}`, 'info');
    log(`  - telemetry.devDeviceId: ${machineIds.devDeviceId}`, 'info');
    if (machineIds.macMachineId) {
      log(`  - telemetry.macMachineId: ${machineIds.macMachineId.substring(0, 16)}...`, 'info');
    }
    
    return { success: true };
  } catch (error) {
    log(`❌ 更新 storage.json 失败: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * 更新 SQLite 数据库中的 serviceMachineId
 */
async function updateServiceMachineId(dbPath, serviceMachineId) {
  try {
    log('🔄 正在更新 state.vscdb 中的 serviceMachineId...', 'info');
    
    // 检查数据库文件是否存在
    try {
      await fs.access(dbPath);
    } catch (err) {
      log('ℹ️ 数据库文件不存在，跳过更新 serviceMachineId', 'info');
      return { success: true };
    }
    
    // 使用 sql.js
    const initSqlJs = require('sql.js');
    
    // 读取数据库文件
    const dbBuffer = await fs.readFile(dbPath);
    
    // 初始化 sql.js
    const SQL = await initSqlJs();
    const db = new SQL.Database(dbBuffer);
    
    try {
      // 执行更新
      db.run('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)', 
        ['storage.serviceMachineId', serviceMachineId]);
      
      // 导出数据库
      const data = db.export();
      
      // 写回文件
      await fs.writeFile(dbPath, data);
      
      log(`✅ serviceMachineId 已更新: ${serviceMachineId}`, 'success');
      
      return { success: true };
    } finally {
      db.close();
    }
  } catch (error) {
    log(`❌ 更新 serviceMachineId 失败: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * 清除 Windsurf 缓存
 */
async function clearWindsurfCache() {
  try {
    log('🔄 正在清除 Windsurf 缓存目录...', 'info');
    
    const userDataPath = getWindsurfUserDataPath();
    const cacheDirectories = [
      path.join(userDataPath, 'Cache'),
      path.join(userDataPath, 'CachedData'),
      path.join(userDataPath, 'CachedExtensions'),
      path.join(userDataPath, 'CachedExtensionVSIXs'),
      path.join(userDataPath, 'Code Cache'),
      path.join(userDataPath, 'GPUCache')
    ];
    
    let clearedCount = 0;
    for (const dir of cacheDirectories) {
      try {
        await fs.access(dir);
        await fs.rm(dir, { recursive: true, force: true });
        log(`✅ 已清除: ${path.basename(dir)}`, 'success');
        clearedCount++;
      } catch (err) {
        // 目录不存在，跳过
      }
    }
    
    log(`✅ Windsurf 缓存目录清除完成 (清除了 ${clearedCount} 个目录)`, 'success');
    return { success: true };
  } catch (error) {
    log(`⚠️ 清除 Windsurf 缓存失败（可忽略）: ${error.message}`, 'warning');
    return { success: true };
  }
}

/**
 * 重置 macOS 系统标识符
 */
async function resetMacIdentifiers() {
  try {
    log('🔄 正在重置 macOS Windsurf 系统标识符...', 'info');
    
    const homeDir = os.homedir();
    const cacheDirectories = [
      path.join(homeDir, 'Library/Caches/com.windsurf'),
      path.join(homeDir, 'Library/Saved Application State/com.windsurf.savedState')
    ];
    
    let deletedCount = 0;
    for (const dir of cacheDirectories) {
      try {
        await fs.access(dir);
        await fs.rm(dir, { recursive: true, force: true });
        log(`✅ 已删除缓存目录: ${path.basename(dir)}`, 'success');
        deletedCount++;
      } catch (err) {
        log(`ℹ️ 跳过不存在的目录: ${path.basename(dir)}`, 'info');
      }
    }
    
    log(`✅ macOS Windsurf 系统标识符已重置 (删除了 ${deletedCount} 个目录)`, 'success');
    return { success: true };
  } catch (error) {
    log(`❌ 重置 macOS Windsurf 标识符失败: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * 完整重置 Windsurf 机器ID
 */
async function fullResetWindsurf(customInstallPath = null) {
  try {
    log('', 'info');
    log('='.repeat(60), 'info');
    log('🔄 开始重置 Windsurf 机器ID', 'info');
    log('='.repeat(60), 'info');
    log('', 'info');
    
    // Windows 系统检测安装路径
    if (process.platform === 'win32' && !customInstallPath) {
      log('📋 步骤 0: 检测 Windsurf 安装路径', 'info');
      const detectedPath = await detectWindsurfInstallPath();
      if (detectedPath) {
        log(`✅ 已检测到安装路径: ${detectedPath}`, 'success');
      } else {
        log('⚠️ 未检测到安装路径，将使用默认配置路径', 'warning');
      }
      log('', 'info');
    }
    
    // 检查并关闭应用
    const isRunning = await checkWindsurfRunning();
    if (isRunning) {
      const closeResult = await closeWindsurf();
      if (!closeResult.success) {
        throw new Error(closeResult.error);
      }
    } else {
      log('ℹ️ Windsurf 未运行，无需关闭', 'info');
    }
    
    log('', 'info');
    log('📋 步骤 1: 生成新的机器ID', 'info');
    const machineIds = generateMachineIds();
    log('✅ 已生成新的机器ID', 'success');
    log(`  - 主机器ID: ${machineIds.mainMachineId}`, 'info');
    log(`  - 遥测ID: ${machineIds.telemetryMachineId.substring(0, 16)}...`, 'info');
    log(`  - SQM ID: ${machineIds.sqmId}`, 'info');
    log(`  - 开发设备ID: ${machineIds.devDeviceId}`, 'info');
    log(`  - 服务ID: ${machineIds.serviceMachineId}`, 'info');
    if (machineIds.macMachineId) {
      log(`  - macOS机器ID: ${machineIds.macMachineId.substring(0, 16)}...`, 'info');
    }
    
    log('', 'info');
    log('📋 步骤 2: 更新配置文件', 'info');
    const paths = getWindsurfPaths();
    
    // 2.1 更新 machineid 文件
    const machineIdResult = await updateMachineIdFile(paths.machineIdFile, machineIds.mainMachineId);
    if (!machineIdResult.success) {
      throw new Error('更新 machineid 文件失败');
    }
    
    // 2.2 更新 storage.json
    const storageResult = await updateStorageJson(paths.storageJson, machineIds);
    if (!storageResult.success) {
      throw new Error('更新 storage.json 失败');
    }
    
    // 2.3 更新 SQLite 数据库
    const dbResult = await updateServiceMachineId(paths.stateDb, machineIds.serviceMachineId);
    if (!dbResult.success) {
      log('⚠️ 更新数据库失败，但继续执行', 'warning');
    }
    
    log('', 'info');
    log('📋 步骤 3: 清除 Windsurf 缓存目录', 'info');
    await clearWindsurfCache();
    
    log('', 'info');
    log('📋 步骤 4: 平台特定处理', 'info');
    const platform = process.platform;
    if (platform === 'darwin') {
      await resetMacIdentifiers();
    } else {
      log('ℹ️ 非 macOS 平台，跳过平台特定处理', 'info');
    }
    
    log('', 'info');
    log('='.repeat(60), 'success');
    log('✅ Windsurf 机器ID重置成功！', 'success');
    log('='.repeat(60), 'success');
    log('', 'info');
    log('💡 提示: 请重新启动 Windsurf 应用以使更改生效', 'warning');
    
    return {
      success: true,
      message: 'Windsurf 机器ID重置成功',
      machineIds: machineIds
    };
  } catch (error) {
    log('', 'info');
    log('='.repeat(60), 'error');
    log(`❌ Windsurf 机器ID重置失败: ${error.message}`, 'error');
    log('='.repeat(60), 'error');
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  fullResetWindsurf,
  setLogCallback,
  getWindsurfUserDataPath,
  getWindsurfPaths,
  checkWindsurfRunning,
  closeWindsurf,
  detectWindsurfInstallPath
};
