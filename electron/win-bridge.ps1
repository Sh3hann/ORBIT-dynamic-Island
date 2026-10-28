# Persistent Low-CPU Windows Native Hardware, Media (Spotify/YouTube/SMTC) & WhatsApp Call Bridge

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Windows.Forms

$nativeHelperCode = @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Collections.Generic;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr pNotify);
    int UnregisterControlChangeNotify(IntPtr pNotify);
    int GetChannelCount(out int pnChannelCount);
    int SetMasterVolumeLevel(float fLevelDB, Guid pguidEventContext);
    int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
    int GetMasterVolumeLevel(out float pfLevelDB);
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int SetChannelVolumeLevel(uint nChannel, float fLevelDB, Guid pguidEventContext);
    int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, Guid pguidEventContext);
    int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
    int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
    int GetMute(out bool pbMute);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IntPtr ppDevices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumeratorComObject { }

public class WinNative {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr hWnd, StringBuilder strText, int maxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct MONITORINFO {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }

    private static bool lastFullscreenState = false;
    private static IntPtr lastExternalWindow = IntPtr.Zero;

    public static bool IsForegroundFullscreen() {
        try {
            IntPtr fg = GetForegroundWindow();
            if (fg == IntPtr.Zero || !IsWindowVisible(fg)) return false;

            RECT wr;
            if (!GetWindowRect(fg, out wr)) return false;
            int winW = wr.Right - wr.Left;
            int winH = wr.Bottom - wr.Top;

            // If our own 450x330 Dynamic Island overlay has focus, keep previous fullscreen state & target window
            if (winW == 450 && winH == 330) {
                return lastFullscreenState;
            }

            var sbClass = new StringBuilder(256);
            GetClassName(fg, sbClass, sbClass.Capacity);
            string cls = sbClass.ToString();
            if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd" ||
                cls == "Shell_SecondaryTrayWnd" || cls == "MultitaskingViewFrame") {
                lastFullscreenState = false;
                return false;
            }

            // Record this external window so Paste ↵ can restore focus to it accurately!
            lastExternalWindow = fg;

            IntPtr hMon = MonitorFromWindow(fg, 2); // MONITOR_DEFAULTTONEAREST
            if (hMon == IntPtr.Zero) return false;

            MONITORINFO mi = new MONITORINFO();
            mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
            if (!GetMonitorInfo(hMon, ref mi)) return false;

            int monW = mi.rcMonitor.Right - mi.rcMonitor.Left;
            int monH = mi.rcMonitor.Bottom - mi.rcMonitor.Top;

            bool isFull = (wr.Left <= mi.rcMonitor.Left + 2) &&
                          (wr.Top <= mi.rcMonitor.Top + 2) &&
                          (wr.Right >= mi.rcMonitor.Right - 2) &&
                          (wr.Bottom >= mi.rcMonitor.Bottom - 2) &&
                          (winW >= monW - 4) &&
                          (winH >= monH - 4);

            lastFullscreenState = isFull;
            return isFull;
        } catch {
            return false;
        }
    }

    public static void FocusAndPasteToLastWindow() {
        try {
            if (lastExternalWindow != IntPtr.Zero && IsWindowVisible(lastExternalWindow)) {
                uint pid;
                uint targetThread = GetWindowThreadProcessId(lastExternalWindow, out pid);
                uint curThread = GetCurrentThreadId();
                if (targetThread != 0 && targetThread != curThread) {
                    AttachThreadInput(curThread, targetThread, true);
                    if (IsIconic(lastExternalWindow)) {
                        ShowWindow(lastExternalWindow, 9);
                    }
                    SetForegroundWindow(lastExternalWindow);
                    BringWindowToTop(lastExternalWindow);
                    AttachThreadInput(curThread, targetThread, false);
                } else {
                    SetForegroundWindow(lastExternalWindow);
                }
                System.Threading.Thread.Sleep(75);
            }
            // Synthesize hardware-level Ctrl+V (release Alt/Shift first)
            keybd_event(0x12, 0, 2, UIntPtr.Zero); // Alt up
            keybd_event(0x10, 0, 2, UIntPtr.Zero); // Shift up
            keybd_event(0x11, 0, 0, UIntPtr.Zero); // Ctrl down
            keybd_event(0x56, 0, 0, UIntPtr.Zero); // V down
            System.Threading.Thread.Sleep(25);
            keybd_event(0x56, 0, 2, UIntPtr.Zero); // V up
            keybd_event(0x11, 0, 2, UIntPtr.Zero); // Ctrl up
        } catch {}
    }

    public static void SendMediaKey(byte vk) {
        keybd_event(vk, 0, 0, UIntPtr.Zero);
        keybd_event(vk, 0, 2, UIntPtr.Zero);
    }

    public static bool IsMouseDown() {
        return ((GetAsyncKeyState(0x01) & 0x8000) != 0) || ((GetAsyncKeyState(0x02) & 0x8000) != 0);
    }

    private static IAudioEndpointVolume GetVolumeObject() {
        var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
        IMMDevice dev = null;
        Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
        Guid epvId = typeof(IAudioEndpointVolume).GUID;
        IAudioEndpointVolume epv = null;
        Marshal.ThrowExceptionForHR(dev.Activate(ref epvId, 23, 0, out epv));
        return epv;
    }

    public static int GetVolume() {
        try {
            float v = 0;
            GetVolumeObject().GetMasterVolumeLevelScalar(out v);
            return (int)Math.Round(v * 100);
        } catch { return -1; }
    }

    public static bool GetMute() {
        try {
            bool m = false;
            GetVolumeObject().GetMute(out m);
            return m;
        } catch { return false; }
    }

    public static void SetVolume(int pct) {
        try {
            float scalar = Math.Max(0f, Math.Min(1f, pct / 100f));
            GetVolumeObject().SetMasterVolumeLevelScalar(scalar, Guid.Empty);
        } catch { }
    }

    public static void SetMute(bool mute) {
        try {
            GetVolumeObject().SetMute(mute, Guid.Empty);
        } catch { }
    }

    public static List<string> ScanMediaAndCallWindows() {
        var list = new List<string>();
        try {
            EnumWindows((hWnd, lParam) => {
                if (!IsWindowVisible(hWnd)) return true;
                int len = GetWindowTextLength(hWnd);
                if (len <= 1) return true;
                var sb = new StringBuilder(len + 1);
                GetWindowText(hWnd, sb, sb.Capacity);
                string title = sb.ToString();
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                try {
                    var proc = Process.GetProcessById((int)pid);
                    string pName = (proc.ProcessName ?? "").ToLowerInvariant();
                    if (pName.Contains("spotify") || pName.Contains("whatsapp") ||
                        pName.Contains("chrome") || pName.Contains("msedge") ||
                        pName.Contains("brave") || pName.Contains("firefox") || pName.Contains("vlc")) {
                        list.Add(pName + "|" + title);
                    }
                } catch {}
                return true;
            }, IntPtr.Zero);
        } catch {}
        return list;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct SP_DEVINFO_DATA {
        public uint cbSize;
        public Guid ClassGuid;
        public uint DevInst;
        public IntPtr Reserved;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DEVPROPKEY {
        public Guid fmtid;
        public uint pid;
    }

    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr SetupDiGetClassDevs(IntPtr ClassGuid, string Enumerator, IntPtr hwndParent, uint Flags);

    [DllImport("setupapi.dll", SetLastError = true)]
    private static extern bool SetupDiEnumDeviceInfo(IntPtr DeviceInfoSet, uint MemberIndex, ref SP_DEVINFO_DATA DeviceInfoData);

    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool SetupDiGetDevicePropertyW(
        IntPtr DeviceInfoSet,
        ref SP_DEVINFO_DATA DeviceInfoData,
        ref DEVPROPKEY PropertyKey,
        out uint PropertyType,
        byte[] PropertyBuffer,
        uint PropertyBufferSize,
        out uint RequiredSize,
        uint Flags);

    [DllImport("setupapi.dll", SetLastError = true)]
    private static extern bool SetupDiDestroyDeviceInfoList(IntPtr DeviceInfoSet);

    public static Dictionary<string, int> GetBluetoothBatteries() {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        IntPtr hDevInfo = SetupDiGetClassDevs(IntPtr.Zero, null, IntPtr.Zero, 0x02 | 0x04);
        if (hDevInfo == IntPtr.Zero || hDevInfo == new IntPtr(-1)) return result;
        try {
            SP_DEVINFO_DATA devData = new SP_DEVINFO_DATA();
            devData.cbSize = (uint)Marshal.SizeOf(typeof(SP_DEVINFO_DATA));

            DEVPROPKEY batKey = new DEVPROPKEY {
                fmtid = new Guid("104ea319-6ee2-4701-bd47-8ddbf425bbe5"),
                pid = 2
            };
            DEVPROPKEY nameKey = new DEVPROPKEY {
                fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),
                pid = 14
            };

            byte[] buf = new byte[512];
            uint idx = 0;
            while (SetupDiEnumDeviceInfo(hDevInfo, idx, ref devData)) {
                idx++;
                uint propType, reqSize;
                if (SetupDiGetDevicePropertyW(hDevInfo, ref devData, ref batKey, out propType, buf, (uint)buf.Length, out reqSize, 0)) {
                    int bat = buf[0];
                    if (bat >= 0 && bat <= 100) {
                        string name = "Bluetooth Device";
                        if (SetupDiGetDevicePropertyW(hDevInfo, ref devData, ref nameKey, out propType, buf, (uint)buf.Length, out reqSize, 0) && reqSize > 2) {
                            name = Encoding.Unicode.GetString(buf, 0, (int)reqSize - 2);
                        }
                        string cleanName = name.Replace(" Hands-Free AG", "").Replace(" Stereo", "").Replace(" Avrcp Transport", "").Trim();
                        if (!string.IsNullOrWhiteSpace(cleanName)) {
                            result[cleanName] = bat;
                        }
                    }
                }
            }
        } catch {} finally {
            SetupDiDestroyDeviceInfoList(hDevInfo);
        }
        return result;
    }
}
"@

try {
    Add-Type -TypeDefinition $nativeHelperCode -Language CSharp -ErrorAction SilentlyContinue
} catch {}

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.GetParameters().Count -eq 1 -and
    $_.IsGenericMethod -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await-WinRT($WinRtTask, [Type]$ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(1200) | Out-Null
    return $netTask.Result
}

$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Devices.Bluetooth.BluetoothDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceInformationCollection, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$null = [Windows.Media.Devices.MediaDevice, Windows.Media.Devices, ContentType = WindowsRuntime]

$script:lastSongKey = ""
$script:cachedThumbBase64 = ""

function Read-ThumbnailBase64($thumbRef) {
    if ($null -eq $thumbRef) { return "" }
    try {
        $winrtStream = Await-WinRT ($thumbRef.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
        if ($null -eq $winrtStream -or $winrtStream.Size -le 0) { return "" }
        $netStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($winrtStream)
        $ms = New-Object System.IO.MemoryStream
        $netStream.CopyTo($ms)
        $bytes = $ms.ToArray()
        $ms.Dispose()
        $netStream.Dispose()
        $winrtStream.Dispose()
        if ($bytes.Length -gt 0) {
            return "data:image/jpeg;base64," + [Convert]::ToBase64String($bytes)
        }
    } catch {}
    return ""
}

function Get-ActiveMediaSession {
    try {
        $mgr = Await-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
        if ($null -eq $mgr) { return $null }

        $sessions = $mgr.GetSessions()
        $bestSession = $null
        if ($null -ne $sessions) {
            foreach ($s in $sessions) {
                $pb = $s.GetPlaybackInfo()
                if ($null -ne $pb -and $pb.PlaybackStatus.ToString() -eq "Playing") {
                    $bestSession = $s
                    break
                }
                if ($null -eq $bestSession) { $bestSession = $s }
            }
        }
        if ($null -eq $bestSession) {
            $bestSession = $mgr.GetCurrentSession()
        }
        return $bestSession
    } catch {
        return $null
    }
}

function Get-MediaAndCallSnapshot {
    $result = @{
        hasMedia = $false
        playing = $false
        title = ""
        artist = ""
        album = ""
        sourceApp = ""
        positionSec = 0
        durationSec = 0
        thumbnail = ""
        whatsappCall = $null
    }

    $winList = [WinNative]::ScanMediaAndCallWindows()
    $fallbackMedia = $null
    foreach ($entry in $winList) {
        $parts = $entry.Split("|", 2)
        if ($parts.Count -lt 2) { continue }
        $proc = $parts[0]
        $wTitle = $parts[1].Trim()

        if ($proc.Contains("whatsapp") -and ($wTitle -match "(?i)(voice call|video call|incoming call|calling|whatsapp call)")) {
            $result.whatsappCall = @{
                active = $true
                title = $wTitle
            }
        }

        if ($proc -eq "spotify" -and $wTitle -ne "Spotify" -and $wTitle -ne "Spotify Free" -and $wTitle -ne "Spotify Premium" -and $wTitle.Contains(" - ")) {
            $sp = $wTitle.Split(" - ", 2)
            $fallbackMedia = @{
                title = $sp[1].Trim()
                artist = $sp[0].Trim()
                sourceApp = "Spotify"
                playing = $true
            }
        }
        elseif (($proc -match "chrome|msedge|brave|firefox") -and ($wTitle -match "(?i)\s-\sYouTube(\sMusic)?")) {
            $clean = $wTitle -replace "(?i)\s-\s(Google\sChrome|Microsoft\u200B?\sEdge|Brave|Mozilla\sFirefox).*$", ""
            $isYtMusic = $clean -match "(?i)\s-\sYouTube\sMusic$"
            $clean = $clean -replace "(?i)\s-\sYouTube(\sMusic)?$", ""
            $clean = $clean -replace "^\(\d+\)\s*", ""
            if ($clean.Length -gt 1 -and $clean -ne "YouTube" -and $clean -ne "YouTube Music") {
                $fallbackMedia = @{
                    title = $clean.Trim()
                    artist = if ($isYtMusic) { "YouTube Music" } else { "YouTube" }
                    sourceApp = if ($isYtMusic) { "YouTube Music" } else { "YouTube" }
                    playing = $true
                }
            }
        }
    }

    $session = Get-ActiveMediaSession
    if ($null -ne $session) {
        try {
            $pbInfo = $session.GetPlaybackInfo()
            $status = if ($null -ne $pbInfo) { $pbInfo.PlaybackStatus.ToString() } else { "Paused" }
            $isPlaying = ($status -eq "Playing")

            $props = Await-WinRT ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            if ($null -ne $props -and -not [string]::IsNullOrWhiteSpace($props.Title)) {
                $timeline = $session.GetTimelineProperties()
                $posSec = 0
                $durSec = 0
                if ($null -ne $timeline) {
                    $posSec = [Math]::Max(0.0, [Math]::Round($timeline.Position.TotalSeconds, 2))
                    $durSec = [Math]::Max(0.0, [Math]::Round($timeline.EndTime.TotalSeconds, 2))
                    if ($isPlaying -and $timeline.LastUpdatedTime.Year -gt 2000) {
                        $elapsed = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalSeconds
                        if ($elapsed -gt 0 -and $elapsed -lt 3600) {
                            if ($durSec -gt 0) {
                                $posSec = [Math]::Min($durSec, [Math]::Round($posSec + $elapsed, 2))
                            } else {
                                $posSec = [Math]::Round($posSec + $elapsed, 2)
                            }
                        }
                    }
                }

                $songKey = "$($props.Title)|$($props.Artist)"
                if ($songKey -ne $script:lastSongKey -or [string]::IsNullOrEmpty($script:cachedThumbBase64)) {
                    $script:lastSongKey = $songKey
                    $thumbData = Read-ThumbnailBase64 $props.Thumbnail
                    if (-not [string]::IsNullOrEmpty($thumbData)) {
                        $script:cachedThumbBase64 = $thumbData
                    } elseif ($songKey -ne $script:lastSongKey) {
                        $script:cachedThumbBase64 = ""
                    }
                }

                $result.hasMedia = $true
                $result.playing = $isPlaying
                $result.title = [string]$props.Title
                $result.artist = [string]$props.Artist
                $result.album = [string]$props.AlbumTitle
                $result.sourceApp = [string]$session.SourceAppUserModelId
                $result.positionSec = $posSec
                $result.durationSec = $durSec
                $result.thumbnail = $script:cachedThumbBase64
                return $result
            }
        } catch {}
    }

    if ($null -ne $fallbackMedia) {
        $result.hasMedia = $true
        $result.playing = [bool]$fallbackMedia.playing
        $result.title = [string]$fallbackMedia.title
        $result.artist = [string]$fallbackMedia.artist
        $result.sourceApp = [string]$fallbackMedia.sourceApp
    }

    return $result
}

function Invoke-MediaAction([string]$cmd, [string]$arg) {
    $session = Get-ActiveMediaSession
    if ($null -ne $session) {
        try {
            switch ($cmd) {
                "play"   { $null = $session.TryPlayAsync(); return }
                "pause"  { $null = $session.TryPauseAsync(); return }
                "toggle" { $null = $session.TryTogglePlayPauseAsync(); return }
                "next"   { $null = $session.TrySkipNextAsync(); return }
                "prev"   { $null = $session.TrySkipPreviousAsync(); return }
                "seek"   {
                    $sec = [double]$arg
                    $ticks = [long]($sec * 10000000)
                    $null = $session.TryChangePlaybackPositionAsync($ticks)
                    return
                }
            }
        } catch {}
    }

    switch ($cmd) {
        "play"   { [WinNative]::SendMediaKey(0xB3) }
        "pause"  { [WinNative]::SendMediaKey(0xB3) }
        "toggle" { [WinNative]::SendMediaKey(0xB3) }
        "next"   { [WinNative]::SendMediaKey(0xB0) }
        "prev"   { [WinNative]::SendMediaKey(0xB1) }
    }
}

$script:cachedBrightness = 80
$script:brightCounter = 0

function Get-BrightnessCached {
    if ($script:brightCounter % 4 -eq 0) {
        try {
            $b = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1
            if ($null -ne $b) { $script:cachedBrightness = [int]$b.CurrentBrightness }
        } catch {}
    }
    $script:brightCounter++
    return $script:cachedBrightness
}

function Set-Brightness([int]$val) {
    $clamped = [Math]::Max(5, [Math]::Min(100, $val))
    $script:cachedBrightness = $clamped
    try {
        $m = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Select-Object -First 1
        if ($null -ne $m) {
            Invoke-CimMethod -InputObject $m -MethodName WmiSetBrightness -Arguments @{ Timeout = 1; Brightness = [byte]$clamped } | Out-Null
        }
    } catch {}
}

$script:prevRx = 0
$script:prevTx = 0
$script:prevNetTime = [DateTime]::UtcNow

function Get-NetSpeed {
    $rxRate = 0
    $txRate = 0
    try {
        $ifaces = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() | Where-Object {
            $_.OperationalStatus -eq 'Up' -and $_.NetworkInterfaceType -ne 'Loopback'
        }
        [long]$totalRx = 0
        [long]$totalTx = 0
        foreach ($nic in $ifaces) {
            $stats = $nic.GetIPv4Statistics()
            $totalRx += $stats.BytesReceived
            $totalTx += $stats.BytesSent
        }
        $now = [DateTime]::UtcNow
        $dt = ($now - $script:prevNetTime).TotalSeconds
        if ($script:prevRx -gt 0 -and $dt -gt 0.2) {
            $rxRate = [Math]::Max(0, [long](($totalRx - $script:prevRx) / $dt))
            $txRate = [Math]::Max(0, [long](($totalTx - $script:prevTx) / $dt))
        }
        $script:prevRx = $totalRx
        $script:prevTx = $totalTx
        $script:prevNetTime = $now
    } catch {}
    return @{ rxBytesPerSec = $rxRate; txBytesPerSec = $txRate }
}

$script:lastReportedFs = $false
$script:btCacheCounter = 0
$script:cachedBluetooth = $null

function Get-BluetoothAndAudioSnapshot {
    if ($null -ne $script:cachedBluetooth -and ($script:btCacheCounter % 2 -ne 0)) {
        $script:btCacheCounter++
        return $script:cachedBluetooth
    }
    $script:btCacheCounter++

    $devicesList = @()
    $connectedCount = 0
    $defaultAudioName = "System Speakers"
    $batMap = @{}

    try {
        $batMap = [WinNative]::GetBluetoothBatteries()
    } catch {}

    # 1. Active Windows Audio Output Endpoint Name
    try {
        $defRenderId = [Windows.Media.Devices.MediaDevice]::GetDefaultAudioRenderId([Windows.Media.Devices.AudioDeviceRole]::Default)
        $renderSel = [Windows.Media.Devices.MediaDevice]::GetAudioRenderSelector()
        $renderCol = Await-WinRT ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($renderSel)) ([Windows.Devices.Enumeration.DeviceInformationCollection])
        if ($null -ne $renderCol) {
            foreach ($r in $renderCol) {
                if ($r.Id -eq $defRenderId) {
                    $defaultAudioName = [string]$r.Name
                    break
                }
            }
        }
    } catch {}

    # 2. Paired & Connected Windows Bluetooth Devices
    try {
        $btSel = [Windows.Devices.Bluetooth.BluetoothDevice]::GetDeviceSelectorFromPairingState($true)
        $btCol = Await-WinRT ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($btSel)) ([Windows.Devices.Enumeration.DeviceInformationCollection])
        if ($null -ne $btCol) {
            foreach ($d in $btCol) {
                try {
                    $devName = ([string]$d.Name).Trim()
                    if ([string]::IsNullOrWhiteSpace($devName)) { continue }
                    if ($devName -match "(?i)(mouse|keyboard|trackpad)") { continue }
                    if ($devName.Length -gt 32 -and (-not $devName.Contains(" "))) { continue }

                    $isConn = $false
                    try {
                        $btObj = Await-WinRT ([Windows.Devices.Bluetooth.BluetoothDevice]::FromIdAsync($d.Id)) ([Windows.Devices.Bluetooth.BluetoothDevice])
                        if ($null -ne $btObj) {
                            $isConn = ($btObj.ConnectionStatus.ToString() -eq "Connected")
                        }
                    } catch {}

                    if ($defaultAudioName.IndexOf($devName, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                        $isConn = $true
                    }
                    if ($isConn) { $connectedCount++ }

                    $hwBat = 100
                    if ($null -ne $batMap -and $batMap.ContainsKey($devName)) {
                        $hwBat = [int]$batMap[$devName]
                    } elseif ($null -ne $batMap) {
                        foreach ($k in $batMap.Keys) {
                            if ($k.IndexOf($devName, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or
                                $devName.IndexOf($k, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                                $hwBat = [int]$batMap[$k]
                                break
                            }
                        }
                    }

                    $leftBat = [Math]::Max(10, [Math]::Min(100, $hwBat))
                    $rightBat = [Math]::Max(10, [Math]::Min(100, $hwBat))
                    $caseBat = if ($hwBat -ge 98) { 95 } else { [Math]::Max(15, $hwBat - 5) }

                    $devicesList += @{
                        id = [string]$d.Id
                        name = $devName
                        connected = [bool]$isConn
                        batteryPct = $hwBat
                        leftBattery = $leftBat
                        rightBattery = $rightBat
                        caseBattery = $caseBat
                        type = "earbuds"
                    }
                } catch {}
            }
        }
    } catch {}

    # 3. Also include any Bluetooth audio device found in PnP battery map if not already listed
    try {
        if ($null -ne $batMap) {
            foreach ($k in $batMap.Keys) {
                if ($k -match "(?i)(mouse|keyboard|trackpad)") { continue }
                $exists = $false
                foreach ($item in $devicesList) {
                    if ($item.name.IndexOf($k, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or
                        $k.IndexOf($item.name, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                        $exists = $true
                        break
                    }
                }
                if (-not $exists) {
                    $bVal = [int]$batMap[$k]
                    $isConnOut = ($defaultAudioName.IndexOf($k, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)
                    $devicesList += @{
                        id = "bt-pnp-$k"
                        name = [string]$k
                        connected = [bool]$isConnOut
                        batteryPct = $bVal
                        leftBattery = $bVal
                        rightBattery = $bVal
                        caseBattery = if ($bVal -ge 98) { 95 } else { [Math]::Max(15, $bVal - 5) }
                        type = "earbuds"
                    }
                }
            }
        }
    } catch {}

    # 4. Include active USB / Headset audio device
    try {
        if (-not [string]::IsNullOrWhiteSpace($defaultAudioName)) {
            $cleanOut = $defaultAudioName
            if ($cleanOut -match "^[^\(]+\((.+)\)$") {
                $cleanOut = $Matches[1].Trim()
            }
            $alreadyIn = $false
            foreach ($existing in $devicesList) {
                if ($existing.name -eq $cleanOut -or $defaultAudioName.IndexOf($existing.name, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                    $alreadyIn = $true
                    break
                }
            }
            if (-not $alreadyIn) {
                $devicesList += @{
                    id = "audio-default"
                    name = $cleanOut
                    connected = $true
                    batteryPct = 100
                    leftBattery = 100
                    rightBattery = 100
                    caseBattery = 100
                    type = "audio-output"
                }
            }
        }
    } catch {}

    # Pick active device: prefer connected Bluetooth earbuds first, then first paired Bluetooth earbuds, then active audio output
    $activeDev = $null
    foreach ($item in $devicesList) {
        if ($item.connected -and $item.type -eq "earbuds") {
            $activeDev = $item
            break
        }
    }
    if ($null -eq $activeDev) {
        foreach ($item in $devicesList) {
            if ($item.type -eq "earbuds" -and $item.name -match "(?i)(liberty|soundcore|airpods|buds|sony|bose|jbl)") {
                $activeDev = $item
                break
            }
        }
    }
    if ($null -eq $activeDev) {
        foreach ($item in $devicesList) {
            if ($item.type -eq "earbuds") {
                $activeDev = $item
                break
            }
        }
    }
    if ($null -eq $activeDev -and $devicesList.Count -gt 0) {
        $activeDev = $devicesList[0]
    }

    $script:cachedBluetooth = @{
        connectedCount = $connectedCount
        defaultAudioOutput = $defaultAudioName
        activeDevice = $activeDev
        devices = $devicesList
    }
    return $script:cachedBluetooth
}

function Emit-State {
    $snap = Get-MediaAndCallSnapshot
    $net = Get-NetSpeed
    $vol = [WinNative]::GetVolume()
    $mute = [WinNative]::GetMute()
    $bright = Get-BrightnessCached
    $isFs = [WinNative]::IsForegroundFullscreen()
    $bt = Get-BluetoothAndAudioSnapshot
    $script:lastReportedFs = $isFs

    $payload = @{
        media = $snap
        whatsappCall = $snap.whatsappCall
        volume = $vol
        muted = $mute
        brightness = $bright
        net = $net
        isFullscreen = $isFs
        bluetooth = $bt
    }
    $json = $payload | ConvertTo-Json -Compress -Depth 5
    [Console]::Out.WriteLine("STATE:$json")
    [Console]::Out.Flush()
}

if ($args.Count -gt 0 -and $args[0] -eq "--once") {
    Emit-State
    exit 0
}

Emit-State
while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    $line = $line.Trim()
    if ($line -eq "poll") {
        Emit-State
    } elseif ($line -eq "checkmouse") {
        $down = [WinNative]::IsMouseDown()
        if ($down) {
            [Console]::Out.WriteLine("MOUSEDOWN:1")
        } else {
            [Console]::Out.WriteLine("MOUSEDOWN:0")
        }
        [Console]::Out.Flush()
    } elseif ($line -eq "checkfullscreen") {
        $isFs = [WinNative]::IsForegroundFullscreen()
        if ($isFs -ne $script:lastReportedFs) {
            $script:lastReportedFs = $isFs
            $flag = if ($isFs) { "1" } else { "0" }
            [Console]::Out.WriteLine("FULLSCREEN:$flag")
            [Console]::Out.Flush()
        }
    } elseif ($line -eq "paste") {
        [WinNative]::FocusAndPasteToLastWindow()
    } elseif ($line.StartsWith("copyfile:")) {
        $fPath = $line.Substring(9).Trim()
        if (Test-Path $fPath) {
            try {
                $col = New-Object System.Collections.Specialized.StringCollection
                [void]$col.Add((Resolve-Path $fPath).Path)
                [System.Windows.Forms.Clipboard]::SetFileDropList($col)
            } catch {
                try {
                    [System.Windows.Forms.Clipboard]::SetText((Resolve-Path $fPath).Path)
                } catch {}
            }
        }
    } elseif ($line.StartsWith("media:")) {
        $parts = $line.Split(":", 3)
        $action = $parts[1]
        $arg = if ($parts.Count -gt 2) { $parts[2] } else { "" }
        Invoke-MediaAction $action $arg
        Start-Sleep -Milliseconds 120
        Emit-State
    } elseif ($line.StartsWith("volume:")) {
        $v = [int]($line.Split(":")[1])
        [WinNative]::SetVolume($v)
    } elseif ($line.StartsWith("mute:")) {
        $m = ($line.Split(":")[1] -eq "1")
        [WinNative]::SetMute($m)
    } elseif ($line.StartsWith("brightness:")) {
        $b = [int]($line.Split(":")[1])
        Set-Brightness $b
    }
}
