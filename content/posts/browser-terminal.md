---
title: 在浏览器里模拟一个小终端
date: 2026-11-13
description: 用命令注册表、模拟 Pod 和真正的 JSON 文件搭建欢迎终端。
tags: [JavaScript, 命令行]
---

打开桌面上的终端，可以看到 Felix 的 ASCII 签名和两条命令。欢迎画面走的也是命令分发流程，所以可以用方向键找回命令，再执行一次。

```sh
kubectl describe pod felix
cat interests.json
```

## 用 Pod 状态写简介

`kubectl describe pod felix` 打印一份本地的模拟 Pod。名字、命名空间、标签和简介来自同一个对象。`kubectl get pods` 读同一份对象，把名字和状态排成一行。

这个形式很适合短简介。了解 Kubernetes 的人一眼能认出结构，也可以通过普通的关于页看到同样的信息。

## 把文件留在文件里

`interests.json` 是项目里的静态文件。`cat` 根据文件名从虚拟文件表找到地址，把读到的原文放进终端。关于页从同一个 JSON 文件读出兴趣列表。

如果以后要增加 `cat links.json`，可以添加文件，再把它登记到虚拟文件表。终端的输入、滚动和输出样式都由界面模块统一处理。

## 注册一个命令

命令定义包含名字、用法和运行函数。运行函数接收参数和上下文，返回要输出的文字，也可以返回异步结果。`help` 直接读取这些定义来生成可用命令列表。

```js
{
  name: "hello",
  usage: "hello",
  run: () => "Hello, Felix."
}
```
