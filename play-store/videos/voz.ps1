# Genera la narración de un video con las voces en español de Windows (OneCore: Pablo o Laura).
#   powershell -ExecutionPolicy Bypass -File voz.ps1 -Texto archivo.txt -Salida voz.wav [-Voz Pablo] [-Velocidad 1.05]
param([string]$Texto, [string]$Salida, [string]$Voz = 'Pablo', [double]$Velocidad = 1.05)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }

$s = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -like "*$Voz*" -and $_.Language -like 'es*' } | Select-Object -First 1
if ($v) { $s.Voice = $v }
$s.Options.SpeakingRate = $Velocidad
$s.Options.AppendedSilence = [Windows.Media.SpeechSynthesis.SpeechAppendedSilence]::Min

$txt = [IO.File]::ReadAllText($Texto, [Text.Encoding]::UTF8)
$stream = Await ($s.SynthesizeTextToStreamAsync($txt)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
$n = [uint32]$stream.Size
$null = Await ($reader.LoadAsync($n)) ([uint32])
$bytes = New-Object byte[] $n
$reader.ReadBytes($bytes)
[IO.File]::WriteAllBytes($Salida, $bytes)
Write-Output "$($s.Voice.DisplayName) -> $Salida ($n bytes)"
