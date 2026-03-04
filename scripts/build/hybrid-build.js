#!/usr/bin/env node
import { runHybridBuild } from './runHybridBuild.js';

runHybridBuild().catch((error) => {
    console.error('[build-static] failed:', error);
    process.exit(1);
});
