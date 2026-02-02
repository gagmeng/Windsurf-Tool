# Windsurf-Tool 打包说明

本文档详细说明如何在不同平台上打包 Windsurf-Tool 应用程序。

## 目录

- [环境准备](#环境准备)
- [Windows 打包](#windows-打包)
- [macOS 打包](#macos-打包)
- [Linux 打包](#linux-打包)
- [常见问题](#常见问题)

---

## 环境准备

### 基础要求

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 18.x | 推荐使用 LTS 版本 |
| npm | >= 9.x | 随 Node.js 安装 |
| Git | 最新版 | 用于版本控制 |

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/gagmeng/Windsurf-Tool.git
cd Windsurf-Tool

# 安装依赖
npm install
```

---

## Windows 打包

### 方式一：使用 npm 脚本（推荐）

```bash
# 打包所有架构 (x64, ia32, arm64)
npm run build:win

# 仅打包 x64 架构
npm run build:win:x64

# 仅打包 arm64 架构
npm run build:win:arm64
```

### 方式二：直接使用 electron-builder

```bash
# 打包所有 Windows 架构
npx electron-builder --win --x64 --ia32 --arm64 -c.npmRebuild=false

# 仅打包 x64
npx electron-builder --win --x64
```

### 输出文件

打包完成后，文件位于 `dist/` 目录：

| 文件类型 | 文件名格式 | 说明 |
|----------|------------|------|
| NSIS 安装程序 | `Windsurf-Tool-Setup-{版本}-{架构}.exe` | 安装程序 |
| 便携版目录 | `win-unpacked/` | 免安装版本 |

---

## macOS 打包

### 方式一：使用 npm 脚本

```bash
# 打包通用版本 (x64 + arm64)
npm run build:mac

# 仅打包 Intel 版本 (x64)
npm run build:mac:x64

# 仅打包 Apple Silicon 版本 (arm64)
npm run build:mac:arm64

# 交互式打包（推荐）
npm run build:mac:interactive
# 或
./build-mac.sh
```

### 方式二：直接使用 electron-builder

```bash
# 打包所有 macOS 架构
npx electron-builder --mac --x64 --arm64

# 仅打包 arm64
npx electron-builder --mac --arm64
```

### 代码签名（可选）

如需进行代码签名，请设置以下环境变量：

```bash
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
```

### 输出文件

| 文件类型 | 文件名格式 | 说明 |
|----------|------------|------|
| DMG | `Windsurf-Tool-{版本}-macOS-{架构}.dmg` | 磁盘镜像 |
| APP | `mac/Windsurf-Tool.app` | 应用程序包 |

---

## Linux 打包

### 使用 npm 脚本

```bash
# 打包 Linux 版本
npm run build:linux

# 仅打包 x64 架构
npm run build:linux:x64
```

### 直接使用 electron-builder

```bash
npx electron-builder --linux --x64
```

### 输出文件

| 文件类型 | 文件名格式 | 说明 |
|----------|------------|------|
| AppImage | `Windsurf-Tool-{版本}-x64.AppImage` | 便携格式 |
| DEB | `Windsurf-Tool-{版本}-x64.deb` | Debian 安装包 |

---

## 快速参考

### 常用命令速查

```bash
# 开发模式
npm start           # 启动应用
npm run dev         # Vite 开发模式

# 打包命令
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
npm run build:all   # 全平台
```

### 版本信息

当前版本：`6.4.1`（见 `package.json`）

修改版本号后重新打包：
```bash
# 编辑 package.json 中的 version 字段
npm run build:win   # 重新打包
```

---

## 常见问题

### 1. 依赖安装失败

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

### 2. Puppeteer 下载 Chromium 失败

设置镜像源：
```bash
# Windows PowerShell
$env:PUPPETEER_DOWNLOAD_HOST="https://npmmirror.com/mirrors"
npm install

# macOS/Linux
export PUPPETEER_DOWNLOAD_HOST="https://npmmirror.com/mirrors"
npm install
```

### 3. Windows 上打包时原生模块编译失败

```bash
# 安装 Windows 构建工具
npm install --global windows-build-tools

# 或使用管理员权限的 PowerShell
npm install --global --production windows-build-tools
```

### 4. macOS 代码签名问题

如果不需要签名，可以跳过：
```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac
```

### 5. 打包后应用无法启动

检查 `asarUnpack` 配置，确保需要的原生模块已正确解包。

---

## 项目结构

```
Windsurf-Tool/
├── main.js              # Electron 主进程
├── renderer.js          # 渲染进程
├── index.html           # 主页面
├── package.json         # 项目配置
├── js/                  # JavaScript 模块
│   ├── accountLogin.js  # 账号登录
│   ├── accountQuery.js  # 账号查询
│   └── constants.js     # 常量配置
├── src/                 # 源码目录
├── build/               # 打包资源
│   ├── icon.ico         # Windows 图标
│   └── icon.png         # macOS/Linux 图标
├── build-scripts/       # 构建脚本
│   └── installer.nsh    # NSIS 安装脚本
└── dist/                # 打包输出目录
```

---

## 技术栈

- **框架**: Electron 26.x
- **打包工具**: electron-builder 24.x
- **构建工具**: electron-vite 4.x
- **自动化**: Puppeteer 21.x

---

## License

MIT License
