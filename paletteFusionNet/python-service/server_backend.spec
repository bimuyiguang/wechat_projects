# -*- mode: python ; coding: utf-8 -*-


block_cipher = None


a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=[],
    datas=[('models', 'models'), ('style', 'style'), ('fabric', 'fabric'), ('kuanshi', 'kuanshi'), ('fengjing', 'fengjing')],
    hiddenimports=['flask', 'flask_cors', 'torch', 'cv2'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['torchvision', 'matplotlib', 'skimage', 'sklearn', 'scipy', 'pandas', 'IPython', 'notebook', 'nbformat', 'nbconvert', 'PyQt5', 'tkinter', 'bokeh', 'astropy', 'dask', 'tables', 'sqlalchemy', 'pytest', 'sphinx', 'numba', 'llvmlite', 'h5py', 'boto3', 'botocore', 'tensorflow'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='server_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='server_backend',
)
