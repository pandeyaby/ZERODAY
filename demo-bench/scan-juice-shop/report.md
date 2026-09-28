# ZERODAY scan — juice-shop

> **Human review required.** Candidates, not proof of exploitability. No exploit code. No auto-merge.

Rules: 10 CWEs. Antares (`fdtn-ai/antares-1b`): 8 CWEs chosen for this repository by `antares plan`, 121 tool calls in 25s.

## By CWE

| CWE | Rules | Antares | Both |
|-----|------:|--------:|-----:|
| CWE-89 | 11 | — | — |
| CWE-79 | 4 | — | — |
| CWE-22 | 8 | — | — |
| CWE-94 | 3 | 4 | 0 |
| CWE-502 | 0 | 1 | 0 |
| CWE-918 | 1 | — | — |
| CWE-611 | 1 | — | — |
| CWE-798 | 48 | — | — |
| CWE-601 | 1 | 1 | 1 |
| CWE-352 | 0 | 1 | 0 |
| CWE-862 | 0 | 1 | 0 |
| CWE-113 | 0 | 1 | 0 |
| CWE-287 | 0 | 5 | 0 |
| CWE-444 | 0 | 1 | 0 |

## Files

### 1. `routes/chat.ts` — CWE-287, CWE-79

Flagged by: antares + rules

- line 218: CWE-79: Request input from line 191 (`req.body?.messages`) reaches this call. [rule cwe-79/xss-response]

  ```
            case 'text-delta':
              res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: event.text } }] })}\n\n`)
              break
  ```
- Antares (CWE-287): Improper Authentication

### 2. `routes/redirect.ts` — CWE-601

Flagged by: antares + rules

- line 18: CWE-601: Request input from line 13 (`req.query`) reaches this call. [rule cwe-601/redirect]

  ```
        challengeUtils.solveIf(challenges.redirectChallenge, () => { return isUnintendedRedirect(toUrl) })
        res.redirect(toUrl)
      } else {
  ```
- Antares (CWE-601): URL Redirection to Untrusted Site ('Open Redirect')

### 3. `rsn/rsnUtil.ts` — CWE-444, CWE-502, CWE-862, CWE-94

Flagged by: antares

- Antares (CWE-444): Inconsistent Interpretation of HTTP Requests ('HTTP Request/Response Smuggling')
- Antares (CWE-502): Deserialization of Untrusted Data
- Antares (CWE-862): Missing Authorization
- Antares (CWE-94): Improper Control of Generation of Code ('Code Injection')

### 4. `frontend/src/app/Services/request.interceptor.ts` — CWE-113

Flagged by: antares

- Antares (CWE-113): Improper Neutralization of CRLF Sequences in HTTP Headers ('HTTP Request/Response Splitting')

### 5. `lib/utils.ts` — CWE-287

Flagged by: antares

- Antares (CWE-287): Improper Authentication

### 6. `routes/authenticatedUsers.ts` — CWE-287

Flagged by: antares

- Antares (CWE-287): Improper Authentication

### 7. `routes/deluxe.ts` — CWE-287

Flagged by: antares

- Antares (CWE-287): Improper Authentication

### 8. `routes/updateUserProfile.ts` — CWE-352

Flagged by: antares

- Antares (CWE-352): Cross-Site Request Forgery (CSRF)

### 9. `routes/verify.ts` — CWE-287

Flagged by: antares

- Antares (CWE-287): Improper Authentication

### 10. `rsn/rsn-update.ts` — CWE-94

Flagged by: antares

- Antares (CWE-94): Improper Control of Generation of Code ('Code Injection')

### 11. `rsn/rsn.ts` — CWE-94

Flagged by: antares

- Antares (CWE-94): Improper Control of Generation of Code ('Code Injection')

### 12. `rsn/rsnOutput.ts` — CWE-94

Flagged by: antares

- Antares (CWE-94): Improper Control of Generation of Code ('Code Injection')

### 13. `routes/profileImageUrlUpload.ts` — CWE-22, CWE-918

Flagged by: rules

- line 29: CWE-22: Request input from line 21 (`req.cookies.token`) reaches this call. [rule cwe-22/path-fs]

  ```
            const ext = ['jpg', 'jpeg', 'png', 'svg', 'gif'].includes(url.split('.').slice(-1)[0].toLowerCase()) ? url.split('.').slice(-1)[0].toLowerCase() : 'jpg'
            const fileStream = fs.createWriteStream(`frontend/dist/frontend/assets/public/images/uploads/${loggedInUser.data.id}.${ext}`, { flags: 'w' })
            await finished(Readable.fromWeb(response.body as any).pipe(fileStream))
  ```
- line 24: CWE-918: Request input from line 19 (`req.body.imageUrl`) reaches this call. [rule cwe-918/ssrf]

  ```
          try {
            const response = await fetch(url)
            if (!response.ok || !response.body) {
  ```

### 14. `routes/userProfile.ts` — CWE-79, CWE-94

Flagged by: rules

- line 101: CWE-79: Request input from line 34 (`req.cookies.token`) reaches this call. [rule cwe-79/xss-response]

  ```
  
        res.send(fn(user))
      } catch (err) {
  ```
- line 65: CWE-94: Request input from line 34 (`req.cookies.token`) reaches this call. [rule cwe-94/code-eval]

  ```
            }
            username = eval(code) // eslint-disable-line no-eval
          } catch (err) {
  ```

### 15. `data/static/codefixes/dbSchemaChallenge_1.ts` — CWE-89

Flagged by: rules

- line 5: CWE-89: Request input from line 3 (`req.query.q`) reaches this call. [rule cwe-89/sql-call]

  ```
      criteria = (criteria.length <= 200) ? criteria : criteria.substring(0, 200)
      models.sequelize.query("SELECT * FROM Products WHERE ((name LIKE '%"+criteria+"%' OR description LIKE '%"+criteria+"%') AND deletedAt IS NULL) ORDER BY name")
        .then(([products]: any) => {
  ```

### 16. `lib/insecurity.ts` — CWE-798

Flagged by: rules

- line 21: CWE-798: Credential-shaped literal — rotate it and move it to a secret store. [rule cwe-798/private-key]

  ```
  export const publicKey = fs ? fs.readFileSync('encryptionkeys/jwt.pub', 'utf8') : 'placeholder-public-key'
  const privateKey = '-----BEGIN RSA PRIVATE KEY-----\r\nMIICXAIBAAKBgQDNwqLEe9wgTXCbC7+RPdDbBbeqjdbs4kOPOIGzqLpXvJXlxxW8iMz0EaM4BKUqYsIa+ndv3NAn2RxCd5ubVdJJcX43zO6Ko0TFEZx/65gY3BE0O6syCEmUP4qbSd6exou/F+WTISzbQ5FBVPVmhnYhG/kpwt/cIxK5iUn5hm+4tQIDAQABAoGBAI+8xiPoOrA+KMnG/T4jJsG6TsHQcDHvJi7o1IKC/h
  ```

### 17. `lib/xml.ts` — CWE-611

Flagged by: rules

- line 35: CWE-611: libxml2 NOENT / DTDLOAD flags resolve external entities — review whether untrusted XML reaches this parser. [rule cwe-611/libxml-entity-flags]

  ```
    const libxml2 = await loadLibxml2()
    const option = libxml2.ParseOption.XML_PARSE_NOENT | libxml2.ParseOption.XML_PARSE_DTDLOAD | libxml2.ParseOption.XML_PARSE_NOBLANKS | libxml2.ParseOption.XML_PARSE_NOCDATA
    const sandbox = { libxml2, data, option }
  ```

### 18. `routes/fileServer.ts` — CWE-22

Flagged by: rules

- line 32: CWE-22: Request input from line 14 (`req.params`) reaches this call. [rule cwe-22/path-fs]

  ```
  
        res.sendFile(path.resolve('ftp/', file))
      } else {
  ```

### 19. `data/static/codefixes/loginAdminChallenge_1.ts` — CWE-89

Flagged by: rules

- line 18: CWE-89: Request input from line 18 (`req.body.email`) reaches this call. [rule cwe-89/sql-call]

  ```
      }
      models.sequelize.query(`SELECT * FROM Users WHERE email = '${req.body.email || ''}' AND password = '${security.hash(req.body.password || '')}' AND deletedAt IS NULL`, { model: models.User, plain: true })
        .then((authenticatedUser) => {
  ```

### 20. `frontend/src/app/nft-unlock/nft-unlock.component.spec.ts` — CWE-798

Flagged by: rules

- line 74: CWE-798: `privateKey` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          keysServiceSpy.submitKey.mockReturnValue(of({ success: true, message: 'Success!' }))
          component.privateKey = 'test-private-key'
          component.submitForm()
  ```

### 21. `routes/captcha.ts` — CWE-94

Flagged by: rules

- line 22: CWE-94: Value is built at runtime (not a constant) — check whether it can carry untrusted input. [rule cwe-94/code-eval]

  ```
      const expression = firstTerm.toString() + firstOperator + secondTerm.toString() + secondOperator + thirdTerm.toString()
      const answer = eval(expression).toString() // eslint-disable-line no-eval
  
  ```

### 22. `routes/keyServer.ts` — CWE-22

Flagged by: rules

- line 14: CWE-22: Request input from line 10 (`req.params`) reaches this call. [rule cwe-22/path-fs]

  ```
      if (!file.includes('/')) {
        res.sendFile(path.resolve('encryptionkeys/', file))
      } else {
  ```

### 23. `test/cypress/e2e/contact.spec.ts` — CWE-798, CWE-94

Flagged by: rules

- line 267: CWE-94: Value is built at runtime (not a constant) — check whether it can carry untrusted input. [rule cwe-94/code-eval]

  ```
        // eslint-disable-next-line no-eval
        const answer = eval(val).toString()
        cy.get('#captchaControl').type(answer)
  ```
- line 11: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
      beforeEach(() => {
        cy.login({ email: 'admin', password: 'admin123' })
        cy.visit('/#/contact')
  ```

### 24. `data/static/codefixes/loginAdminChallenge_2.ts` — CWE-89

Flagged by: rules

- line 15: CWE-89: Request input from line 15 (`req.body.password`) reaches this call. [rule cwe-89/sql-call]

  ```
    return (req: Request, res: Response, next: NextFunction) => {
      models.sequelize.query(`SELECT * FROM Users WHERE email = $1 AND password = '${security.hash(req.body.password || '')}' AND deletedAt IS NULL`,
        { bind: [ req.body.email ], model: models.User, plain: true })
        .then((authenticatedUser) => {
  ```

### 25. `frontend/src/app/oauth/oauth.component.spec.ts` — CWE-798

Flagged by: rules

- line 91: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          component.ngOnInit()
          expect(userService.save).toHaveBeenCalledWith({ email: 'test@test.com', password: 'bW9jLnRzZXRAdHNldA==', passwordRepeat: 'bW9jLnRzZXRAdHNldA==' })
      })
  ```

### 26. `frontend/src/assets/private/dat.gui.min.js` — CWE-79

Flagged by: rules

- line 1: CWE-79: Value is built at runtime (not a constant) — check whether it can carry untrusted input. [rule cwe-79/xss-dom-assign]

  ```
  var dat=dat||{};dat.gui=dat.gui||{};dat.utils=dat.utils||{};dat.controllers=dat.controllers||{};dat.dom=dat.dom||{};dat.color=dat.color||{};dat.utils.css=function(){return{load:function(e,a){a=a||document;var b=a.createElement("link");b.type="text/css";b.rel="stylesheet";b.href=e;a.getElementsByTagName("head")[0].appendChild(b)},inject:function(e,a){a=a||document;var b=document.createElement("styl
  ```

### 27. `routes/logfileServer.ts` — CWE-22

Flagged by: rules

- line 14: CWE-22: Request input from line 10 (`req.params`) reaches this call. [rule cwe-22/path-fs]

  ```
      if (!file.includes('/')) {
        res.sendFile(path.resolve('logs/', file))
      } else {
  ```

### 28. `data/static/codefixes/loginBenderChallenge_1.ts` — CWE-89

Flagged by: rules

- line 18: CWE-89: Request input from line 18 (`req.body.email`) reaches this call. [rule cwe-89/sql-call]

  ```
      }
      models.sequelize.query(`SELECT * FROM Users WHERE email = '${req.body.email || ''}' AND password = '${security.hash(req.body.password || '')}' AND deletedAt IS NULL`, { model: models.User, plain: true })
        .then((authenticatedUser) => {
  ```

### 29. `frontend/src/app/payment/payment.component.spec.ts` — CWE-798

Flagged by: rules

- line 351: CWE-798: `token` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          component.mode = 'deluxe'
          userService.upgradeToDeluxe.mockReturnValue(of({ token: 'tokenValue' }))
          const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
  ```

### 30. `frontend/src/hacking-instructor/index.ts` — CWE-79

Flagged by: rules

- line 126: CWE-79: Value is built at runtime (not a constant) — check whether it can carry untrusted input. [rule cwe-79/xss-dom-assign]

  ```
    const textBox = createElement('span', { flexGrow: '2' })
    textBox.innerHTML = snarkdown(hint.text)
  
  ```

### 31. `routes/profileImageFileUpload.ts` — CWE-22

Flagged by: rules

- line 42: CWE-22: Request input from line 34 (`req.cookies.token`) reaches this call. [rule cwe-22/path-fs]

  ```
      try {
        await fs.writeFile(filePath, buffer)
      } catch (err) {
  ```

### 32. `data/static/codefixes/loginBenderChallenge_3.ts` — CWE-89

Flagged by: rules

- line 15: CWE-89: Request input from line 15 (`req.body.password`) reaches this call. [rule cwe-89/sql-call]

  ```
    return (req: Request, res: Response, next: NextFunction) => {
      models.sequelize.query(`SELECT * FROM Users WHERE email = :mail AND password = '${security.hash(req.body.password || '')}' AND deletedAt IS NULL`,
        { replacements: { mail: req.body.email }, model: models.User, plain: true })
        .then((authenticatedUser) => {
  ```

### 33. `frontend/src/app/Services/keys.service.spec.ts` — CWE-798

Flagged by: rules

- line 68: CWE-798: `privateKey` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
      expect(req.request.method).toBe('POST')
      expect(req.request.body).toEqual({ privateKey: 'privateKey' })
      req.flush('apiResponse')
  ```

### 34. `data/static/codefixes/loginBenderChallenge_4.ts` — CWE-89

Flagged by: rules

- line 15: CWE-89: Request input from line 15 (`req.body.email`) reaches this call. [rule cwe-89/sql-call]

  ```
    return (req: Request, res: Response, next: NextFunction) => {
      models.sequelize.query(`SELECT * FROM Users WHERE email = '${req.body.email || ''}' AND password = '${security.hash(req.body.password || '')}' AND deletedAt IS NULL`, { model: models.User, plain: false })
        .then((authenticatedUser) => {
  ```

### 35. `frontend/src/app/Services/two-factor-auth-service.spec.ts` — CWE-798

Flagged by: rules

- line 68: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          expect(req.request.method).toBe('POST')
          expect(req.request.body).toEqual({ password: 's3cr3t!', initialToken: 'initialToken', setupToken: 'setupToken' })
          expect(res).toBe(undefined)
  ```

### 36. `routes/quarantineServer.ts` — CWE-22

Flagged by: rules

- line 14: CWE-22: Request input from line 10 (`req.params`) reaches this call. [rule cwe-22/path-fs]

  ```
      if (!file.includes('/')) {
        res.sendFile(path.resolve('ftp/quarantine/', file))
      } else {
  ```

### 37. `data/static/codefixes/loginJimChallenge_2.ts` — CWE-89

Flagged by: rules

- line 15: CWE-89: Request input from line 15 (`req.body.email`) reaches this call. [rule cwe-89/sql-call]

  ```
    return (req: Request, res: Response, next: NextFunction) => {
      models.sequelize.query(`SELECT * FROM Users WHERE email = '${req.body.email || ''}' AND password = '${security.hash(req.body.password || '')}' AND deletedAt IS NULL`, { model: models.User, plain: false })
        .then((authenticatedUser) => {
  ```

### 38. `frontend/src/app/two-factor-auth/two-factor-auth.component.spec.ts` — CWE-798

Flagged by: rules

- line 243: CWE-798: `secret` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          it('should expose the totpSecret to the initial token input via data attribute', () => {
              twoFactorAuthService.status.mockReturnValue(of({ setup: false, email: 'e', secret: 'super-secret', setupToken: 't' }))
              component.updateStatus()
  ```

### 39. `routes/vulnCodeFixes.ts` — CWE-22

Flagged by: rules

- line 81: CWE-22: Request input from line 71 (`req.body.key`) reaches this call. [rule cwe-22/path-fs]

  ```
      if (fs.existsSync('./data/static/codefixes/' + key + '.info.yml')) {
        const codingChallengeInfos = yaml.load(fs.readFileSync('./data/static/codefixes/' + key + '.info.yml', 'utf8'))
        const selectedFixInfo = codingChallengeInfos?.fixes.find(({ id }: { id: number }) => id === selectedFix + 1)
  ```

### 40. `data/static/codefixes/loginJimChallenge_4.ts` — CWE-89

Flagged by: rules

- line 18: CWE-89: Request input from line 18 (`req.body.email`) reaches this call. [rule cwe-89/sql-call]

  ```
      }
      models.sequelize.query(`SELECT * FROM Users WHERE email = '${req.body.email || ''}' AND password = '${security.hash(req.body.password || '')}' AND deletedAt IS NULL`, { model: models.User, plain: true })
        .then((authenticatedUser) => {
  ```

### 41. `routes/vulnCodeSnippet.ts` — CWE-22

Flagged by: rules

- line 90: CWE-22: Request input from line 71 (`req.body.key`) reaches this call. [rule cwe-22/path-fs]

  ```
    if (await fs.stat('./data/static/codefixes/' + key + '.info.yml')) {
      const codingChallengeInfos = yaml.load(await fs.readFile('./data/static/codefixes/' + key + '.info.yml', { encoding: 'utf8' }))
      if (codingChallengeInfos?.hints) {
  ```

### 42. `test/api/2fa.test.ts` — CWE-798

Flagged by: rules

- line 42: CWE-798: `secret` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
  
      const totpToken = generateSync({ secret: 'IFTXE3SPOEYVURT2MRYGI52TKJ4HC3KH' })
  
  ```

### 43. `data/static/codefixes/unionSqlInjectionChallenge_1.ts` — CWE-89

Flagged by: rules

- line 6: CWE-89: Request input from line 3 (`req.query.q`) reaches this call. [rule cwe-89/sql-call]

  ```
      criteria.replace(/"|'|;|and|or/i, "")
      models.sequelize.query(`SELECT * FROM Products WHERE ((name LIKE '%${criteria}%' OR description LIKE '%${criteria}%') AND deletedAt IS NULL) ORDER BY name`)
        .then(([products]: any) => {
  ```

### 44. `test/api/address.test.ts` — CWE-798

Flagged by: rules

- line 24: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: 'jim@juice-sh.op',
        password: 'ncc-1701'
      })
  ```

### 45. `routes/login.ts` — CWE-89

Flagged by: rules

- line 34: CWE-89: Request input from line 34 (`req.body.email`) reaches this call. [rule cwe-89/sql-call]

  ```
      verifyPreLoginChallenges(req) // vuln-code-snippet hide-line
      models.sequelize.query(`SELECT * FROM Users WHERE email = '${req.body.email || ''}' AND password = '${security.hash(req.body.password || '')}' AND deletedAt IS NULL`, { model: UserModel, plain: true }) // vuln-code-snippet vuln-line loginAdminChallenge loginBenderChallenge loginJimChallenge
        .then((authenticatedUser) => { //
  ```

### 46. `test/api/authenticated-users.test.ts` — CWE-798

Flagged by: rules

- line 37: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: `jim@${config.get<string>('application.domain')}`,
        password: 'ncc-1701'
      })
  ```

### 47. `routes/search.ts` — CWE-89

Flagged by: rules

- line 23: CWE-89: Request input from line 21 (`req.query.q`) reaches this call. [rule cwe-89/sql-call]

  ```
      criteria = (criteria.length <= 200) ? criteria : criteria.substring(0, 200)
      models.sequelize.query(`SELECT * FROM Products WHERE ((name LIKE '%${criteria}%' OR description LIKE '%${criteria}%') AND deletedAt IS NULL) ORDER BY name`) // vuln-code-snippet vuln-line unionSqlInjectionChallenge dbSchemaChallenge
        .then(([products]: any) => {
  ```

### 48. `test/api/basket-item.test.ts` — CWE-798

Flagged by: rules

- line 23: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: 'jim@juice-sh.op',
        password: 'ncc-1701'
      })
  ```

### 49. `test/api/basket.test.ts` — CWE-798

Flagged by: rules

- line 32: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: 'jim@juice-sh.op',
        password: 'ncc-1701'
      })
  ```

### 50. `test/api/chat.test.ts` — CWE-798

Flagged by: rules

- line 261: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
    void it('POST includes authenticated user name in system prompt', { timeout: 15000 }, async () => {
      const { token } = await login(app, { email: 'bjoern.kimminich@gmail.com', password: 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=' })
      let parsedBody: any
  ```

### 51. `test/api/checkKeys.test.ts` — CWE-798

Flagged by: rules

- line 35: CWE-798: `privateKey` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          .post('/rest/web3/submitKey')
          .send({ privateKey: 'lalalala' })
  
  ```

### 52. `test/api/data-export.test.ts` — CWE-798

Flagged by: rules

- line 53: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
    void it('Export data with empty JSON body but valid token still succeeds without CAPTCHA', async () => {
      const { token } = await login(app, { email: 'bjoern.kimminich@gmail.com', password: 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=' })
      const authHeader = { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }
  ```

### 53. `test/api/delivery.test.ts` — CWE-798

Flagged by: rules

- line 28: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          email: 'jim@' + config.get<string>('application.domain'),
          password: 'ncc-1701'
        })
  ```

### 54. `test/api/deluxe.test.ts` — CWE-798

Flagged by: rules

- line 25: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: 'bender@' + config.get<string>('application.domain'),
        password: 'OhG0dPlease1nsertLiquor!'
      })
  ```

### 55. `test/api/erasure-request.test.ts` — CWE-798

Flagged by: rules

- line 36: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
    void it('GET erasure form rendering fails for users without assigned security answer', async () => {
      const { token } = await login(app, { email: 'bjoern.kimminich@gmail.com', password: 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=' })
  
  ```

### 56. `test/api/feedback.test.ts` — CWE-798

Flagged by: rules

- line 117: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: 'bjoern.kimminich@gmail.com',
        password: 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI='
      })
  ```

### 57. `test/api/login.test.ts` — CWE-798

Flagged by: rules

- line 27: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          email: 'kalli@kasper.le',
          password: 'kallliiii'
        })
  ```

### 58. `test/api/memory.test.ts` — CWE-798

Flagged by: rules

- line 32: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: 'jim@' + config.get<string>('application.domain'),
        password: 'ncc-1701'
      })
  ```

### 59. `test/api/order-history.test.ts` — CWE-798

Flagged by: rules

- line 25: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: 'admin@' + config.get<string>('application.domain'),
        password: 'admin123'
      })
  ```

### 60. `test/api/password.test.ts` — CWE-798

Flagged by: rules

- line 28: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          email: 'kuni@be.rt',
          password: 'kunigunde'
        })
  ```

### 61. `test/api/payment.test.ts` — CWE-798

Flagged by: rules

- line 20: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
    app = result.app
    const { token } = await login(app, { email: 'jim@juice-sh.op', password: 'ncc-1701' })
    authHeader = { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }
  ```

### 62. `test/api/product-review.test.ts` — CWE-798

Flagged by: rules

- line 101: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: 'bjoern.kimminich@gmail.com',
        password: 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI='
      })
  ```

### 63. `test/api/profile-image-upload.test.ts` — CWE-798

Flagged by: rules

- line 31: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: `jim@${config.get<string>('application.domain')}`,
        password: 'ncc-1701'
      })
  ```

### 64. `test/api/quantity.test.ts` — CWE-798

Flagged by: rules

- line 25: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: `jim@${config.get<string>('application.domain')}`,
        password: 'ncc-1701'
      })
  ```

### 65. `test/api/user-profile.test.ts` — CWE-798

Flagged by: rules

- line 21: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
    app = result.app
    const { token } = await login(app, { email: 'jim@juice-sh.op', password: 'ncc-1701' })
    authHeader = { Cookie: `token=${token}` }
  ```

### 66. `test/api/user.test.ts` — CWE-798

Flagged by: rules

- line 52: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          email: 'horst@horstma.nn',
          password: 'hooooorst'
        })
  ```

### 67. `test/cypress/e2e/administration.spec.ts` — CWE-798

Flagged by: rules

- line 5: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: 'admin',
        password: 'admin123'
      })
  ```

### 68. `test/cypress/e2e/b2bOrder.spec.ts` — CWE-798

Flagged by: rules

- line 6: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          if (!isDocker) {
            cy.login({ email: 'admin', password: 'admin123' })
  
  ```

### 69. `test/cypress/e2e/basket.spec.ts` — CWE-798

Flagged by: rules

- line 4: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
      beforeEach(() => {
        cy.login({ email: 'admin', password: 'admin123' })
      })
  ```

### 70. `test/cypress/e2e/changePassword.spec.ts` — CWE-798

Flagged by: rules

- line 6: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          email: 'morty',
          password: 'focusOnScienceMorty!focusOnScience'
        })
  ```

### 71. `test/cypress/e2e/chatbot.spec.ts` — CWE-798

Flagged by: rules

- line 8: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
    beforeEach(() => {
      cy.login({ email: 'admin', password: 'admin123' })
    })
  ```

### 72. `test/cypress/e2e/complain.spec.ts` — CWE-798

Flagged by: rules

- line 5: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
        email: 'admin',
        password: 'admin123'
      })
  ```

### 73. `test/cypress/e2e/dataErasure.spec.ts` — CWE-798

Flagged by: rules

- line 3: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
    beforeEach(() => {
      cy.login({ email: 'admin', password: 'admin123' })
    })
  ```

### 74. `test/cypress/e2e/dataExport.spec.ts` — CWE-798

Flagged by: rules

- line 24: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
      it('should be possible to steal admin user data by causing email clash during export', () => {
        cy.login({ email: 'admun', password: 'admun123' })
  
  ```

### 75. `test/cypress/e2e/deluxe.spec.ts` — CWE-798

Flagged by: rules

- line 4: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
      it('should be possible to pass in a forgotten test parameter abusing the redirect-endpoint to load an external image', () => {
        cy.login({ email: 'jim', password: 'ncc-1701' })
        cy.location().then((loc) => {
  ```

### 76. `test/cypress/e2e/noSql.spec.ts` — CWE-798

Flagged by: rules

- line 8: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
      beforeEach(() => {
        cy.login({ email: 'admin', password: 'admin123' })
      })
  ```

### 77. `test/cypress/e2e/passwordHashLeak.spec.ts` — CWE-798

Flagged by: rules

- line 3: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
    beforeEach(() => {
      cy.login({ email: 'admin@juice-sh.op', password: 'admin123' })
    })
  ```

### 78. `test/cypress/e2e/profile.spec.ts` — CWE-798

Flagged by: rules

- line 3: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
    beforeEach(() => {
      cy.login({ email: 'admin', password: 'admin123' })
    })
  ```

### 79. `test/cypress/e2e/register.spec.ts` — CWE-798

Flagged by: rules

- line 10: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          email: 'admin',
          password: 'admin123'
        })
  ```

### 80. `test/cypress/e2e/restApi.spec.ts` — CWE-798

Flagged by: rules

- line 4: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
      beforeEach(() => {
        cy.login({ email: 'admin', password: 'admin123' })
      })
  ```

### 81. `test/cypress/e2e/search.spec.ts` — CWE-798

Flagged by: rules

- line 56: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          email: 'admin',
          password: 'admin123'
        })
  ```

### 82. `test/cypress/e2e/totpSetup.spec.ts` — CWE-798

Flagged by: rules

- line 6: CWE-798: `password` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
          email: 'wurstbrot',
          password: 'EinBelegtesBrotMitSchinkenSCHINKEN!',
          totpSecret: 'IFTXE3SPOEYVURT2MRYGI52TKJ4HC3KH'
  ```

### 83. `test/server/currentUser.unit.test.ts` — CWE-798

Flagged by: rules

- line 31: CWE-798: `token` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
    void it('should return ID and email of user belonging to cookie from the request', () => {
      req.cookies.token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJkYXRhIjp7ImlkIjoxLCJlbWFpbCI6ImFkbWluQGp1aWNlLXNoLm9wIiwibGFzdExvZ2luSXAiOiIwLjAuMC4wIiwicHJvZmlsZUltYWdlIjoiZGVmYXVsdC5zdmcifSwiaWF0IjoxNTgyMjIyMzY0fQ.CHiFQieZudYlrd1o8Ih-Izv7XY_WZupt8Our-CP9HqsczyEKqrWC7wWguOgVuSGDN_S3mP4FyuEFN8l60aAhVsUbqz
  ```

### 84. `test/server/preconditionValidation.unit.test.ts` — CWE-798

Flagged by: rules

- line 80: CWE-798: `ALCHEMY_API_KEY` is assigned a string literal — move secrets to configuration or a secret store. [rule cwe-798/hardcoded-credential]

  ```
      void it('should return true if environment variable is present', () => {
        process.env.ALCHEMY_API_KEY = 'test-key'
        assert.equal(checkIfEnvironmentVariableExists('ALCHEMY_API_KEY'), true)
  ```

