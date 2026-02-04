#!/usr/bin/env node

// Small wrapper so the published binary always has a proper shebang.
// (Our bundled dist output may start with `"use strict";`, which zsh will try to execute.)
require("../dist/cli.js");


