# 哈基虾桌面宠物 - 开机自启动脚本
# 以管理员权限运行此脚本

$targetPath = "C:\Users\Administrator\.openclaw\workspace\projects\openclaw-desktop-pet\start.bat"
$shortcutPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Hajixia.lnk"

# 创建启动目录
$startupDir = Split-Path $shortcutPath -Parent
if (!(Test-Path $startupDir)) {
    New-Item -ItemType Directory -Force -Path $startupDir | Out-Null
}

# 创建快捷方式
$WScriptObj = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptObj.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetPath
$Shortcut.WorkingDirectory = "C:\Users\Administrator\.openclaw\workspace\projects\openclaw-desktop-pet"
$Shortcut.Description = "Hajixia 3D Desktop Pet"
$Shortcut.IconLocation = "shell32.dll,13"
$Shortcut.Save()

Write-Host "OK - Autostart shortcut created at:" -ForegroundColor Green
Write-Host $shortcutPath -ForegroundColor Yellow
