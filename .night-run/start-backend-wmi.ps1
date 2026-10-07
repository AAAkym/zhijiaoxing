$ErrorActionPreference = 'Stop'
$cmd = 'cmd /c cd /d C:\Users\33552\Desktop\project_code\backend && venv\Scripts\python.exe -X utf8 src/main.py 1> C:\Users\33552\Desktop\project_code\logs\backend-run.log 2> C:\Users\33552\Desktop\project_code\logs\backend-run-err.log'
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
Write-Output ("ReturnValue=" + $r.ReturnValue + " ProcessId=" + $r.ProcessId)
