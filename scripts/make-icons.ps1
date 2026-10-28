# Generates ORBIT icons (multi-size .ico, tray icon, installer bitmaps) from build/icon-source.png
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'build\icon-source.png'
$rawImg = [System.Drawing.Bitmap]::FromFile($src)

# Crop 8px from each edge of icon-source.png to remove the 2px white/grey outer border artifact
$cropMargin = 8
$cropW = $rawImg.Width - ($cropMargin * 2)
$cropH = $rawImg.Height - ($cropMargin * 2)
$img = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gCrop = [System.Drawing.Graphics]::FromImage($img)
$gCrop.Clear([System.Drawing.Color]::Black)
$gCrop.DrawImage(
    $rawImg,
    (New-Object System.Drawing.Rectangle(0, 0, $cropW, $cropH)),
    (New-Object System.Drawing.Rectangle($cropMargin, $cropMargin, $cropW, $cropH)),
    [System.Drawing.GraphicsUnit]::Pixel
)
$gCrop.Dispose()
$rawImg.Dispose()

function Resize-Png([System.Drawing.Image]$image, [int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Black)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($image, 0, 0, $size, $size)
    $g.Dispose()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    return ,$ms.ToArray()
}

function Write-Ico([string]$path, [int[]]$sizes) {
    $pngs = @()
    foreach ($s in $sizes) { $pngs += ,(Resize-Png $img $s) }
    $fs = [System.IO.File]::Create($path)
    $bw = New-Object System.IO.BinaryWriter($fs)
    $bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $s = $sizes[$i]
        $dim = if ($s -ge 256) { 0 } else { $s }
        $bw.Write([byte]$dim); $bw.Write([byte]$dim); $bw.Write([byte]0); $bw.Write([byte]0)
        $bw.Write([uint16]1); $bw.Write([uint16]32)
        $bw.Write([uint32]$pngs[$i].Length); $bw.Write([uint32]$offset)
        $offset += $pngs[$i].Length
    }
    foreach ($p in $pngs) { $bw.Write($p) }
    $bw.Close(); $fs.Close()
}

Write-Ico (Join-Path $root 'build\icon.ico') @(256, 128, 64, 48, 32, 24, 16)
Write-Ico (Join-Path $root 'electron\tray-icon.ico') @(32, 24, 16)
[System.IO.File]::WriteAllBytes((Join-Path $root 'electron\tray-icon.png'), (Resize-Png $img 64))
[System.IO.File]::WriteAllBytes((Join-Path $root 'build\icon.png'), (Resize-Png $img 512))
[System.IO.File]::WriteAllBytes((Join-Path $root 'docs\logo.png'), (Resize-Png $img 512))

# NSIS sidebar bitmap (164x314, 24-bit BMP): pure black background with seamless ORBIT logo
$sidebar = New-Object System.Drawing.Bitmap(164, 314, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$gs = [System.Drawing.Graphics]::FromImage($sidebar)
$gs.Clear([System.Drawing.Color]::Black)
$gs.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gs.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gs.DrawImage($img, 7, 82, 150, 150)
$gs.Dispose()
$sidebar.Save((Join-Path $root 'build\installerSidebar.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
$sidebar.Dispose()

# NSIS header bitmap (150x57, 24-bit BMP): white background matching NSIS header bar with right-aligned ORBIT badge
$header = New-Object System.Drawing.Bitmap(150, 57, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$gh = [System.Drawing.Graphics]::FromImage($header)
$gh.Clear([System.Drawing.Color]::White)
$gh.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gh.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$badgeSize = 47
$badgeX = 150 - $badgeSize - 10
$badgeY = 5
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 12
$path.AddArc($badgeX, $badgeY, $r, $r, 180, 90)
$path.AddArc($badgeX + $badgeSize - $r, $badgeY, $r, $r, 270, 90)
$path.AddArc($badgeX + $badgeSize - $r, $badgeY + $badgeSize - $r, $r, $r, 0, 90)
$path.AddArc($badgeX, $badgeY + $badgeSize - $r, $r, $r, 90, 90)
$path.CloseFigure()
$gh.FillPath([System.Drawing.Brushes]::Black, $path)
$gh.SetClip($path)
$gh.DrawImage($img, $badgeX, $badgeY, $badgeSize, $badgeSize)
$gh.ResetClip()
$path.Dispose()
$gh.Dispose()
$header.Save((Join-Path $root 'build\installerHeader.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
$header.Dispose()

$img.Dispose()
Write-Output 'Clean icons and installer bitmaps generated.'
