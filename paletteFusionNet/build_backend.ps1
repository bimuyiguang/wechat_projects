Write-Host "Preparing Python backend package..."

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serviceDir = Join-Path $projectRoot "python-service"

if ($env:PYTHON_EXECUTABLE -and (Test-Path $env:PYTHON_EXECUTABLE)) {
    $pythonExe = $env:PYTHON_EXECUTABLE
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonExe = (Get-Command python).Source
} else {
    Write-Error "Python not found. Set PYTHON_EXECUTABLE env var or add python to PATH."
    exit 1
}

$env:NO_PROXY = "*"
$env:no_proxy = "*"

Set-Location $serviceDir

& $pythonExe -m pip install "pyinstaller==5.13.2"

# Use onedir for faster PyTorch startup; noconsole prevents a backend terminal window.
$pyinstallerArgs = @(
    "--name", "server_backend",
    "--onedir",
    "--noconsole",
    "--clean",
    "--hidden-import=flask",
    "--hidden-import=flask_cors",
    "--hidden-import=torch",
    "--hidden-import=cv2",
    "--exclude-module=torchvision",
    "--exclude-module=matplotlib",
    "--exclude-module=skimage",
    "--exclude-module=sklearn",
    "--exclude-module=scipy",
    "--exclude-module=pandas",
    "--exclude-module=IPython",
    "--exclude-module=notebook",
    "--exclude-module=nbformat",
    "--exclude-module=nbconvert",
    "--exclude-module=PyQt5",
    "--exclude-module=tkinter",
    "--exclude-module=bokeh",
    "--exclude-module=astropy",
    "--exclude-module=dask",
    "--exclude-module=tables",
    "--exclude-module=sqlalchemy",
    "--exclude-module=pytest",
    "--exclude-module=sphinx",
    "--exclude-module=numba",
    "--exclude-module=llvmlite",
    "--exclude-module=h5py",
    "--exclude-module=boto3",
    "--exclude-module=botocore",
    "--exclude-module=tensorflow",
    "--add-data", "models;models",
    "--add-data", "style;style",
    "--add-data", "fabric;fabric",
    "--add-data", "kuanshi;kuanshi",
    "--add-data", "fengjing;fengjing",
    "server.py"
)

& $pythonExe -m PyInstaller @pyinstallerArgs

if (Test-Path "dist\server_backend\server_backend.exe") {
    Write-Host "========================================="
    Write-Host "Backend package created."
    Write-Host "Path: python-service/dist/server_backend/server_backend.exe"
    Write-Host "========================================="
} else {
    Write-Error "Backend package failed. Check the build log."
}

Set-Location $projectRoot
