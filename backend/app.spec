# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import copy_metadata, collect_data_files

datas = (
    # collect additional metadata for some packages, which they mostly
    # use to introspect their own version
    copy_metadata('shapely') +
    collect_data_files('pygeoops') +
    [
        ('../frontend/dist/index.html', 'frontend/dist'),
        ('../frontend/dist/assets', 'frontend/dist/assets'),
    ]
)

a = Analysis(
    ['app/main.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='app',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
