Add-Type -AssemblyName System.Drawing

$repoDir = "C:\Users\ASUS\.gemini\antigravity\scratch\ios27-dynamic-island"
$shotsDir = Join-Path $repoDir "docs\assets\shots"
$outDir = Join-Path $repoDir "docs\screenshots"
$desktopDir = "C:\Users\ASUS\Desktop\ORBIT-Screenshots"

function Create-DesktopScreenshot {
    param (
        [string]$ShotName,
        [string]$Title,
        [string]$SubTitle,
        [System.Drawing.Color]$GlowColor,
        [string]$OutputFile
    )

    $width = 1920
    $height = 1080
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # 1. Dark Wallpaper Background
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point(0, $height)),
        [System.Drawing.Color]::FromArgb(255, 12, 14, 20),
        [System.Drawing.Color]::FromArgb(255, 6, 7, 10)
    )
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)

    # 2. Ambient Desktop Light Glow behind Island
    $glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, $GlowColor.R, $GlowColor.G, $GlowColor.B))
    $g.FillEllipse($glowBrush, 560, 40, 800, 500)
    
    # 3. Subtle secondary ambient light
    $ambientBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 99, 102, 241))
    $g.FillEllipse($ambientBrush, 200, 400, 600, 600)

    # 4. Windows 11 Desktop Taskbar Simulation (at bottom)
    $tbHeight = 48
    $tbY = $height - $tbHeight
    $tbBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 18, 18, 24))
    $g.FillRectangle($tbBrush, 0, $tbY, $width, $tbHeight)
    $tbBorderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(50, 255, 255, 255), 1)
    $g.DrawLine($tbBorderPen, 0, $tbY, $width, $tbY)

    # Draw centered taskbar pill indicators
    $iconBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 255, 255, 255))
    $activeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 255, 255, 255))
    $startX = 960 - 70
    for ($i = 0; $i -lt 5; $i++) {
        $curBrush = if ($i -eq 2) { $activeBrush } else { $iconBrush }
        $g.FillRectangle($curBrush, $startX + ($i * 32), $tbY + 14, 20, 20)
    }

    # Time & Date on bottom right
    $fontTime = New-Object System.Drawing.Font("Arial", 9, [System.Drawing.FontStyle]::Regular)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 255, 255, 255))
    $g.DrawString("4:30 PM`n10/29/2026", $fontTime, $textBrush, $width - 80, $tbY + 8)

    # 5. Place the ORBIT Island Shot at top-center
    $shotPath = Join-Path $shotsDir $ShotName
    if (Test-Path $shotPath) {
        $shot = [System.Drawing.Bitmap]::FromFile($shotPath)
        
        # Scale to realistic 2x retina desktop proportion (width ~680px)
        $targetW = [int]($shot.Width * 0.82)
        $targetH = [int]($shot.Height * 0.82)
        $posX = [int](($width - $targetW) / 2)
        $posY = 18

        # Drop shadow behind island
        $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 0, 0, 0))
        $g.FillEllipse($shadowBrush, $posX - 20, $posY + 20, $targetW + 40, $targetH + 30)

        # Draw Shot
        $g.DrawImage($shot, $posX, $posY, $targetW, $targetH)
        $shot.Dispose()
    }

    # 6. Feature Banner / Caption at Bottom-Left of Desktop
    $cardW = 480
    $cardH = 90
    $cardX = 60
    $cardY = $height - $tbHeight - 120
    
    $cardBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 15, 17, 24))
    $g.FillRectangle($cardBg, $cardX, $cardY, $cardW, $cardH)
    $cardBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(50, 255, 255, 255), 1)
    $g.DrawRectangle($cardBorder, $cardX, $cardY, $cardW, $cardH)

    $fontCardTitle = New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)
    $fontCardSub = New-Object System.Drawing.Font("Arial", 10, [System.Drawing.FontStyle]::Regular)
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 150, 160, 185))

    $g.DrawString($Title, $fontCardTitle, $titleBrush, $cardX + 20, $cardY + 18)
    $g.DrawString($SubTitle, $fontCardSub, $subBrush, $cardX + 20, $cardY + 48)

    # 7. Brand watermark in top-left
    $fontBrand = New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Bold)
    $brandBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 255, 255, 255))
    $g.DrawString("ORBIT Dynamic Island v1.0.0", $fontBrand, $brandBrush, 40, 28)

    # Save to output file
    $bmp.Save($OutputFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Created: $OutputFile"
}

# 1. System Usage Desktop Screenshot
Create-DesktopScreenshot `
    -ShotName "system.png" `
    -Title "Real-Time Hardware Telemetry" `
    -SubTitle "Multi-core CPU meters, RAM breakdown, disk write speed & battery life." `
    -GlowColor ([System.Drawing.Color]::FromArgb(255, 59, 130, 246)) `
    -OutputFile (Join-Path $outDir "screenshot-1-system-usage.png")

# 2. Bluetooth & Earbuds Desktop Screenshot
Create-DesktopScreenshot `
    -ShotName "bluetooth.png" `
    -Title "Bluetooth Earbuds & Soundcore Telemetry" `
    -SubTitle "Left & right earbud battery, charging case percentage, ANC & Spatial 3D." `
    -GlowColor ([System.Drawing.Color]::FromArgb(255, 48, 209, 88)) `
    -OutputFile (Join-Path $outDir "screenshot-2-bluetooth-anc.png")

# 3. WhatsApp & Notifications Desktop Screenshot
Create-DesktopScreenshot `
    -ShotName "alerts.png" `
    -Title "Color-Coded Notifications & WhatsApp" `
    -SubTitle "Dynamic green accent glow with message previews and unread badges." `
    -GlowColor ([System.Drawing.Color]::FromArgb(255, 37, 211, 102)) `
    -OutputFile (Join-Path $outDir "screenshot-3-whatsapp-notifications.png")

# 4. Settings & Windows Startup Desktop Screenshot
Create-DesktopScreenshot `
    -ShotName "settings.png" `
    -Title "Settings & Native Auto-Start" `
    -SubTitle "Toggle 'Start ORBIT with Windows' and pin customized navigation tabs." `
    -GlowColor ([System.Drawing.Color]::FromArgb(255, 168, 85, 247)) `
    -OutputFile (Join-Path $outDir "screenshot-4-settings-autostart.png")

# Copy all screenshots + transparent shots + banner to user's Desktop for easy upload!
Get-ChildItem $outDir -Filter "*.png" | Copy-Item -Destination $desktopDir -Force
Get-ChildItem $shotsDir -Filter "*.png" | Copy-Item -Destination $desktopDir -Force
Copy-Item (Join-Path $repoDir "docs\og-banner.png") -Destination $desktopDir -Force
Copy-Item (Join-Path $repoDir "docs\logo.png") -Destination $desktopDir -Force

Write-Output "All screenshots successfully placed in $desktopDir"
