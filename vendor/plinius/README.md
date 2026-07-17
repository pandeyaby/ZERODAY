# Optional Plinius research clones

ZERODAY is an **original product**. The bridge code lives in `src/plinius/` and does **not** require shipping upstream Plinius repositories inside this git repo.

If you want local copies of the elder-plinius projects for adapters / research gates, clone them yourself (ignored by git):

```bash
npm run plinius:init
# or manually:
mkdir -p vendor/plinius
git clone --depth 1 https://github.com/elder-plinius/T3MP3ST.git vendor/plinius/t3mp3st
git clone --depth 1 https://github.com/elder-plinius/ST3GG.git vendor/plinius/st3gg
git clone --depth 1 https://github.com/elder-plinius/G0DM0D3.git vendor/plinius/g0dm0d3
git clone --depth 1 https://github.com/elder-plinius/CL4R1T4S.git vendor/plinius/cl4r1t4s
git clone --depth 1 https://github.com/elder-plinius/L1B3RT4S.git vendor/plinius/l1b3rt4s
git clone --depth 1 https://github.com/elder-plinius/OBLITERATUS.git vendor/plinius/obliteratus

npm run plinius:st3gg-deps   # optional ST3GG Python venv
```

| Local path | Role in ZERODAY |
|------------|-----------------|
| `t3mp3st/` | Optional — mission/operator pattern reference for the T3MP3ST adapter |
| `st3gg/` | Optional — real stego CLI for the ST3GG adapter |
| `g0dm0d3/` `cl4r1t4s/` `l1b3rt4s/` `obliteratus/` | Optional research libraries (gated OFF by default) |

Without these folders, ZERODAY still runs: adapters report `missing` / not ready, and research gates stay closed.
