Add-Type -AssemblyName System.Drawing

$repoDir = "C:\Users\ASUS\.gemini\antigravity\scratch\ios27-dynamic-island"
$logoPath = Join-Path $repoDir "docs\logo.png"
$shotsDir = Join-Path $repoDir "docs\assets\shots"
$desktopDir = "C:\Users\ASUS\Desktop\ORBIT-Screenshots"
$docsDir = Join-Path $repoDir "docs"

# ==============================================================================
# 1. CREATE PORTRAIT POSTER (1600 x 2400)
# ==============================================================================
function Generate-PortraitPoster {
    $width = 1600
    $height = 2400
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Background
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point(0, $height)),
        [System.Drawing.Color]::FromArgb(255, 8, 9, 14),
        [System.Drawing.Color]::FromArgb(255, 3, 3, 5)
    )
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)

    # Ambient Glow Orbs
    $glow1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(35, 99, 102, 241))
    $g.FillEllipse($glow1, 300, 200, 1000, 1000)
    $glow2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 191, 90, 242))
    $g.FillEllipse($glow2, 600, 1000, 900, 900)
    $glow3 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 48, 209, 88))
    $g.FillEllipse($glow3, 100, 1300, 800, 800)

    # Top Pill Badge: "OFFICIAL RELEASE v1.0.0"
    $badgeW = 440
    $badgeH = 50
    $badgeX = [int](($width - $badgeW) / 2)
    $badgeY = 120
    $badgeBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 20, 22, 32))
    $g.FillRectangle($badgeBg, $badgeX, $badgeY, $badgeW, $badgeH)
    $badgeBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 255, 255), 1.5)
    $g.DrawRectangle($badgeBorder, $badgeX, $badgeY, $badgeW, $badgeH)

    $fontBadge = New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Bold)
    $badgeTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 147, 197, 253))
    $badgeStr = "OFFICIAL RELEASE  ·  VERSION 1.0.0"
    $bSize = $g.MeasureString($badgeStr, $fontBadge)
    $g.DrawString($badgeStr, $fontBadge, $badgeTextBrush, [int]($badgeX + ($badgeW - $bSize.Width) / 2), $badgeY + 15)

    # Logo
    if (Test-Path $logoPath) {
        $logo = [System.Drawing.Bitmap]::FromFile($logoPath)
        $lSize = 130
        $lX = [int](($width - $lSize) / 2)
        $lY = 210
        $g.DrawImage($logo, $lX, $lY, $lSize, $lSize)
        $logo.Dispose()
    }

    # Main Title: "ORBIT"
    $fontTitle = New-Object System.Drawing.Font("Arial", 68, [System.Drawing.FontStyle]::Bold)
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $titleStr = "O R B I T"
    $tSize = $g.MeasureString($titleStr, $fontTitle)
    $g.DrawString($titleStr, $fontTitle, $titleBrush, [int](($width - $tSize.Width) / 2), 370)

    # Subtitle: "DYNAMIC ISLAND"
    $fontSub = New-Object System.Drawing.Font("Arial", 26, [System.Drawing.FontStyle]::Bold)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 168, 85, 247))
    $subStr = "DYNAMIC ISLAND"
    $sSize = $g.MeasureString($subStr, $fontSub)
    $g.DrawString($subStr, $fontSub, $subBrush, [int](($width - $sSize.Width) / 2), 475)

    # Tagline: "Reimagined for Windows 10/11 & Apple macOS"
    $fontTag = New-Object System.Drawing.Font("Arial", 18, [System.Drawing.FontStyle]::Regular)
    $tagBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 210, 215, 230))
    $tagStr = "The Iconic Dynamic Island Experience Built for Desktop"
    $tagSize = $g.MeasureString($tagStr, $fontTag)
    $g.DrawString($tagStr, $fontTag, $tagBrush, [int](($width - $tagSize.Width) / 2), 525)

    # Center Visual: Dynamic Island System Showcase
    $sysShotPath = Join-Path $shotsDir "system.png"
    if (Test-Path $sysShotPath) {
        $shot = [System.Drawing.Bitmap]::FromFile($sysShotPath)
        $sW = 1000
        $sH = [int]($shot.Height * ($sW / $shot.Width))
        $sX = [int](($width - $sW) / 2)
        $sY = 600

        # Island Ambient Shadow
        $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 0, 0, 0))
        $g.FillEllipse($shadowBrush, $sX - 40, $sY + 40, $sW + 80, $sH + 60)

        $g.DrawImage($shot, $sX, $sY, $sW, $sH)
        $shot.Dispose()
    }

    # Second Center Visual: Bluetooth & Earbud ANC Telemetry
    $btShotPath = Join-Path $shotsDir "bluetooth.png"
    if (Test-Path $btShotPath) {
        $shot2 = [System.Drawing.Bitmap]::FromFile($btShotPath)
        $bW = 920
        $bH = [int]($shot2.Height * ($bW / $shot2.Width))
        $bX = [int](($width - $bW) / 2)
        $bY = 1140

        $shadowBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 0, 0, 0))
        $g.FillEllipse($shadowBrush2, $bX - 30, $bY + 30, $bW + 60, $bH + 40)

        $g.DrawImage($shot2, $bX, $bY, $bW, $bH)
        $shot2.Dispose()
    }

    # 4 Key Metrics Cards in a 2x2 Grid (Bottom Section)
    $metrics = @(
        @{ Num = "0.4%"; Label = "Idle CPU Load"; Desc = "Engineered to sip resources and sleep when idle"; Color = [System.Drawing.Color]::FromArgb(255, 48, 209, 88) },
        @{ Num = "~190 MB"; Label = "Memory Footprint"; Desc = "Pure lean performance with zero electron bloat"; Color = [System.Drawing.Color]::FromArgb(255, 10, 132, 255) },
        @{ Num = "60 FPS"; Label = "Spring Physics"; Desc = "Hardware accelerated fluid animations"; Color = [System.Drawing.Color]::FromArgb(255, 191, 90, 242) },
        @{ Num = "100%"; Label = "Private & Offline"; Desc = "No tracking, no telemetry, all local processing"; Color = [System.Drawing.Color]::FromArgb(255, 255, 159, 10) }
    )

    $gridY = 1720
    $colW = 580
    $rowH = 140
    $startX = [int](($width - ($colW * 2 + 40)) / 2)

    for ($i = 0; $i -lt 4; $i++) {
        $row = [int]($i / 2)
        $col = $i % 2
        $mX = $startX + ($col * ($colW + 40))
        $mY = $gridY + ($row * ($rowH + 24))

        $m = $metrics[$i]

        # Card BG
        $cardBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 16, 18, 26))
        $g.FillRectangle($cardBg, $mX, $mY, $colW, $rowH)
        $cardBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 255, 255, 255), 1)
        $g.DrawRectangle($cardBorder, $mX, $mY, $colW, $rowH)

        # Number
        $fontNum = New-Object System.Drawing.Font("Arial", 28, [System.Drawing.FontStyle]::Bold)
        $numBrush = New-Object System.Drawing.SolidBrush($m.Color)
        $g.DrawString($m.Num, $fontNum, $numBrush, $mX + 24, $mY + 22)

        # Label
        $fontLabel = New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)
        $labelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $g.DrawString($m.Label, $fontLabel, $labelBrush, $mX + 24, $mY + 70)

        # Desc
        $fontDesc = New-Object System.Drawing.Font("Arial", 11, [System.Drawing.FontStyle]::Regular)
        $descBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 150, 155, 175))
        $g.DrawString($m.Desc, $fontDesc, $descBrush, $mX + 24, $mY + 98)
    }

    # Bottom Footer: URL & Platforms
    $footerY = 2120
    $fontUrl = New-Object System.Drawing.Font("Arial", 20, [System.Drawing.FontStyle]::Bold)
    $urlBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $urlStr = "sh3hann.github.io/ORBIT-dynamic-Island"
    $uSize = $g.MeasureString($urlStr, $fontUrl)
    $g.DrawString($urlStr, $fontUrl, $urlBrush, [int](($width - $uSize.Width) / 2), $footerY)

    $fontFooterSub = New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Regular)
    $fSubBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 140, 145, 165))
    $fSubStr = "Free & Open Source  ·  Windows 10/11 (64-bit)  ·  Apple macOS (iMac & MacBook)  ·  MIT License"
    $fSubSize = $g.MeasureString($fSubStr, $fontFooterSub)
    $g.DrawString($fSubStr, $fontFooterSub, $fSubBrush, [int](($width - $fSubSize.Width) / 2), $footerY + 45)

    # Save
    $outPath = Join-Path $docsDir "poster.png"
    $desktopOut = Join-Path $desktopDir "ORBIT-Official-Poster.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save($desktopOut, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Portrait Poster created: $outPath & $desktopOut"
}

# ==============================================================================
# 2. CREATE LANDSCAPE BANNER POSTER (1920 x 1080)
# ==============================================================================
function Generate-LandscapePoster {
    $width = 1920
    $height = 1080
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Background
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point($width, $height)),
        [System.Drawing.Color]::FromArgb(255, 10, 11, 16),
        [System.Drawing.Color]::FromArgb(255, 4, 4, 7)
    )
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)

    # Ambient Light Orbs
    $glow1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 99, 102, 241))
    $g.FillEllipse($glow1, 1100, 100, 800, 800)
    $glow2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 48, 209, 88))
    $g.FillEllipse($glow2, 100, 300, 600, 600)

    # Left Column: Brand & Copy
    $leftX = 100
    
    # Pill
    $badgeW = 380
    $badgeH = 38
    $badgeBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 20, 22, 32))
    $g.FillRectangle($badgeBg, $leftX, 130, $badgeW, $badgeH)
    $badgeBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 255, 255), 1)
    $g.DrawRectangle($badgeBorder, $leftX, 130, $badgeW, $badgeH)

    $fontBadge = New-Object System.Drawing.Font("Arial", 11, [System.Drawing.FontStyle]::Bold)
    $badgeTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 147, 197, 253))
    $g.DrawString("OFFICIAL RELEASE  ·  v1.0.0", $fontBadge, $badgeTextBrush, $leftX + 24, 142)

    # Title
    $fontTitle = New-Object System.Drawing.Font("Arial", 62, [System.Drawing.FontStyle]::Bold)
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.DrawString("O R B I T", $fontTitle, $titleBrush, $leftX - 4, 190)

    # Subtitle
    $fontSub = New-Object System.Drawing.Font("Arial", 22, [System.Drawing.FontStyle]::Bold)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 168, 85, 247))
    $g.DrawString("DYNAMIC ISLAND FOR DESKTOP", $fontSub, $subBrush, $leftX, 290)

    # Tagline
    $fontDesc = New-Object System.Drawing.Font("Arial", 15, [System.Drawing.FontStyle]::Regular)
    $descBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 190, 195, 215))
    $descStr = "The iconic Dynamic Island experience reimagined`nfor Windows 10/11 & Apple macOS (iMac & MacBook).`nLive hardware telemetry, Soundcore ANC & lyrics."
    $g.DrawString($descStr, $fontDesc, $descBrush, $leftX, 335)

    # 4 Highlights Pills
    $fontPill = New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Bold)
    $pills = @("⚡ <0.4% Idle CPU", "🪶 ~190 MB RAM", "🎧 Earbud Battery & ANC", "🛡️ 100% Local & Private")
    $pY = 445
    for ($i = 0; $i -lt 4; $i++) {
        $pStr = $pills[$i]
        $pSize = $g.MeasureString($pStr, $fontPill)
        $pW = [int]($pSize.Width + 24)
        $pH = 34
        $pX = if ($i % 2 -eq 0) { $leftX } else { $leftX + 240 }
        $curY = if ($i -lt 2) { $pY } else { $pY + 44 }

        $pBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(160, 25, 28, 40))
        $g.FillRectangle($pBg, $pX, $curY, $pW, $pH)
        $pBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(50, 255, 255, 255), 1)
        $g.DrawRectangle($pBorder, $pX, $curY, $pW, $pH)

        $pTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $g.DrawString($pStr, $fontPill, $pTextBrush, $pX + 12, $curY + 8)
    }

    # Left Bottom URL & Platforms
    $fontUrl = New-Object System.Drawing.Font("Arial", 17, [System.Drawing.FontStyle]::Bold)
    $urlBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 48, 209, 88))
    $g.DrawString("sh3hann.github.io/ORBIT-dynamic-Island", $fontUrl, $urlBrush, $leftX, 580)

    $fontCompat = New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Regular)
    $compatBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 140, 145, 165))
    $g.DrawString("Windows 10/11 (64-bit)  ·  Apple macOS (Universal)  ·  MIT Open Source", $fontCompat, $compatBrush, $leftX, 615)

    # Right Column: Visual Showcase (Overlapping 3D Island Shots)
    $sysShotPath = Join-Path $shotsDir "system.png"
    if (Test-Path $sysShotPath) {
        $shot = [System.Drawing.Bitmap]::FromFile($sysShotPath)
        $sW = 860
        $sH = [int]($shot.Height * ($sW / $shot.Width))
        $sX = 960
        $sY = 120

        # Shadow
        $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(140, 0, 0, 0))
        $g.FillEllipse($shadowBrush, $sX - 30, $sY + 40, $sW + 60, $sH + 60)

        $g.DrawImage($shot, $sX, $sY, $sW, $sH)
        $shot.Dispose()
    }

    $btShotPath = Join-Path $shotsDir "bluetooth.png"
    if (Test-Path $btShotPath) {
        $shot2 = [System.Drawing.Bitmap]::FromFile($btShotPath)
        $bW = 760
        $bH = [int]($shot2.Height * ($bW / $shot2.Width))
        $bX = 1040
        $bY = 520

        # Shadow
        $shadowBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(160, 0, 0, 0))
        $g.FillEllipse($shadowBrush2, $bX - 40, $bY + 30, $bW + 80, $bH + 60)

        $g.DrawImage($shot2, $bX, $bY, $bW, $bH)
        $shot2.Dispose()
    }

    # Save
    $outPath = Join-Path $docsDir "poster-landscape.png"
    $desktopOut = Join-Path $desktopDir "ORBIT-Landscape-Poster.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save($desktopOut, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Landscape Poster created: $outPath & $desktopOut"
}

Generate-PortraitPoster
Generate-LandscapePoster
