Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$fontPath = Join-Path $projectRoot 'node_modules\@expo-google-fonts\inter\900Black\Inter_900Black.ttf'
$fonts = New-Object System.Drawing.Text.PrivateFontCollection
$fonts.AddFontFile($fontPath)
$fontFamily = $fonts.Families[0]

function New-MyPrsBrandImage {
  param(
    [int]$Width,
    [int]$Height,
    [float]$FontSize,
    [string]$OutputPath
  )

  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Black)

  $font = New-Object System.Drawing.Font($fontFamily, $FontSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center

  $rectangle = New-Object System.Drawing.RectangleF(0, 0, $Width, $Height)
  $graphics.DrawString('MyPRS', $font, $brush, $rectangle, $format)
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $format.Dispose()
  $brush.Dispose()
  $font.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-MyPrsBrandImage -Width 512 -Height 512 -FontSize 92 -OutputPath (Join-Path $projectRoot 'assets\favicon.png')
New-MyPrsBrandImage -Width 1200 -Height 630 -FontSize 174 -OutputPath (Join-Path $projectRoot 'public\myprs-link-preview.png')

$fonts.Dispose()
