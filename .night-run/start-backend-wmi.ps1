$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = "C:\Users\33552\Desktop\project_code\backend\venv\Scripts\pythonw.exe -X utf8 src/main.py"; CurrentDirectory = "C:\Users\33552\Desktop\project_code\backend" }
Write-Output ("ReturnValue=" + $r.ReturnValue + " ProcessId=" + $r.ProcessId)
