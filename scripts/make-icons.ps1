# Generates ORBIT icons (multi-size .ico, tray icon, installer bitmaps) from build/icon-source.png
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'build\icon-source.png'
$img = [System.Drawing.Image]::FromFile($src)

function Resize-Png([System.Drawing.Image]$image, [int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
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

# NSIS installer badge bitmaps (BMP): sidebar 164x314 and header 150x57, black background with the logo centred
function Save-Bmp([string]$path, [int]$w, [int]$h, [int]$logo, [int]$logoY) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Black)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, [int](($w - $logo) / 2), $logoY, $logo, $logo)
    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
}
Save-Bmp (Join-Path $root 'build\installerSidebar.bmp') 164 314 150 80
Save-Bmp (Join-Path $root 'build\installerHeader.bmp') 150 57 57 0

$img.Dispose()
Write-Output 'Icons generated.'
