---
title: 自用VS Code配置
date: 2026-06-02 18:57:00
categories:
  - 编程
tags:
  - 工具配置
feed:
  enable: true
description: 自用的vscode配置，用于备份
---
# C++

> launch.json
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug current file",
            // 需要安装插件CodeLLDB,或填 "cppdbg" 若用微软 cpptools
            "type": "lldb",
            "request": "launch",
            "program": "${fileDirname}/${fileBasenameNoExtension}",
            "args": [],
            "cwd": "${fileDirname}",
            "preLaunchTask": "clang-build" // 调试前自动编译
        }
    ]
    
}
```
> task.json
```json
{
    "version": "2.0.0",
    "tasks": [
        {
            // 需安装微软的 C/C++ 插件
            "type": "cppbuild",
            "label": "clang-build",
            "command": "/usr/bin/clang++-20",
            "args": [
                // 启用彩色诊断输出，编译错误/警告带颜色高亮
                "-fcolor-diagnostics",
                // 启用ANSI转义码，让终端彩色输出正常工作
                "-fansi-escape-codes",
                // 生成独立的调试信息，避免依赖外部调试符号文件
                "-fstandalone-debug",
                // AddressSanitizer，检测内存越界、使用已释放内存等错误（已禁用）
                //"-fsanitize=address", 
                "-std=c++20",
                "-fmodules",
                // 保留调试信息
                "-g",
                "${file}",
                "-o",
                "${fileDirname}/${fileBasenameNoExtension}"
            ],
            "options": {
                "cwd": "${fileDirname}"
            },
            "problemMatcher": [
                "$gcc"
            ],
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "detail": "compiler: /usr/bin/clang++-20"
        }
    ]
}
```

