#!/usr/bin/env node
/**
 * Optional PATH-injectable Antares CLI stand-in for local experiments.
 * Prefer locate({ mockAntares: true }) / --mock-antares in CI tests.
 */
import { mockAntaresMain } from "../src/locate/mock-antares.ts";

const code = await mockAntaresMain(process.argv.slice(2));
process.exit(code);
