#!/bin/bash
set -e

cd "$(dirname "$0")"

# Compile Swift to dynamic library
swiftc -emit-library \
    -o libmenubar_speed.dylib \
    -Xlinker -install_name -Xlinker @rpath/libmenubar_speed.dylib \
    -O \
    MenubarSpeed.swift

echo "Built libmenubar_speed.dylib"
