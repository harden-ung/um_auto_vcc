const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
const puppeteerCloak = require('puppeteer-cloak')

const faker = require('faker')
const figlet = require('figlet')
const chalk = require('chalk')

puppeteer.use(StealthPlugin())
puppeteer.use(AdblockerPlugin({ blockTrackers: true }))

const fs = require('fs-extra')

// settings
const {
  headless,
  useVCC,
  devMode,
  maxRetryNumber,
  ramdomCountriesToSelect,
} = require('./settings.json')

// import accounts

const rawAccounts = fs
  .readFileSync('./accounts.txt')
  .toString()
  .split('\r\n')
  .filter((rawAccount) => rawAccount !== '')

const accounts = rawAccounts
  .map((account) => {
    const [email, password] = account.split(':')
    return { email, password }
  })
  .filter((account) => account.email !== '')

const proxies = fs
  .readFileSync('./proxies.txt')
  .toString()
  .split('\r\n')
  .filter((proxy) => proxy !== '')

// report json
const defaultErrorData = require('./reports/errorData.json')
const defaultUsedData = require('./reports/usedData.json')

const rawVccs = fs
  .readFileSync('./vccs.txt')
  .toString()
  .split('\r\n')
  .filter((rawVcc) => rawVcc != '')

// app states
let usedData = [...defaultUsedData]
let errorData = [...defaultErrorData]

// support functions
function checkForDuplicates(array) {
  return new Set(array).size !== array.length
}

const capitalize = (s) => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const getRandomName = (string, length) => {
  let nameLength = length
  snippet = string.replace(/[^a-zA-Z]/g, '').toLowerCase()

  const start = Math.floor(Math.random() * (snippet.length - 1 - nameLength))

  const end =
    start + 1 + nameLength > snippet.length
      ? snippet.length - start
      : start + nameLength

  return capitalize(snippet.substring(start, end))
}
function getRandomFromArr(arr, n) {
  var result = new Array(n),
    len = arr.length,
    taken = new Array(len)
  if (n > len)
    throw new RangeError('getRandom: more elements taken than available')
  while (n--) {
    var x = Math.floor(Math.random() * len)
    result[n] = arr[x in taken ? taken[x] : x]
    taken[x] = --len in taken ? taken[len] : len
  }
  return result
}
const getRandom = (numb1, numb2) => {
  let high = numb1 > numb2 ? numb1 : numb2
  let low = numb1 < numb2 ? numb1 : numb2
  return Math.round(Math.random() * (high - low)) + low
}
const startNoti = () => {
  console.log(
    chalk.green(
      figlet.textSync('enne', {
        font: 'Ghost',
        horizontalLayout: 'default',
        verticalLayout: 'default',
        whitespaceBreak: true,
      }),
    ),
  )
  console.log('start tool ...')
}
const endNoti = () => {
  console.log('done...')
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
const enhance = (processName, process) => {
  return async (...args) => {
    let timeCounter = 0
    const timeCounterInterval = setInterval(() => {
      timeCounter = timeCounter + 100
    }, 100)
    try {
      console.log(`---${processName} start---`.toUpperCase())
      await process(...args)
      await sleep(1000)
      console.log(`---${processName} end---`.toUpperCase())
    } catch (error) {
      console.log(`${processName} error:`, error)
      throw '500 Internal Service Error'
    } finally {
      console.log(
        `${processName} time: `,
        chalk.black.bgGreen(` ${(timeCounter / 1000).toFixed(1)}s `),
      )
      clearTimeout(timeCounterInterval)
    }
  }
}

const getRandomVcc = () => {
  // get vcc on the fly
  const rawVccs = fs
    .readFileSync('./vccs.txt')
    .toString()
    .split('\r\n')
    .filter((rawVcc) => rawVcc != '')

  const vccs = rawVccs.map((vcc) => {
    const [cardNumber, expiry, cvc, cardName] = vcc.split(':')
    return { cardNumber, expiry, cvc, cardName }
  })

  return getRandomFromArr(vccs, 1)[0]
}

const generateData = async (account) => {
  const data = {
    account,
  }
  return data
}
const optimize = async (page) => {
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    if (req.resourceType() == 'image' || req.resourceType() == 'font') {
      req.abort()
    } else {
      req.continue()
    }
  })

  page.on('dialog', async (dialog) => {
    await dialog.dismiss()
  })
}

const handleSaveReportAndRemove = async () => {
  try {
    await fs.outputJson('./reports/errorData.json', errorData)
    await fs.outputJson('./reports/usedData.json', usedData)

    // remove in accounts.txt if moved to usedData
    const saveAccounts = accounts
      .filter((account) =>
        usedData.every((datum) => datum.account.email !== account.email),
      )
      .map(({ email, password }) => {
        let result = `${email}:${password}`

        return result
      })
      .join('\r\n')
    await fs.writeFile('accounts.txt', saveAccounts, 'utf8')

    console.log('save report and remove usedData')
  } catch (err) {
    console.error('save report error', err)
  }
}

const handleProxyType = async (page, proxy) => {
  const [ip, port, username, password] = proxy.split(':')

  if (username && password) {
    await page.authenticate({
      username: username,
      password: password,
    })
  }
}

// main processes
const handleLogin = async (page, email, password) => {
  await page.goto('https://unitedmasters.com/account/login', {
    waitUntil: 'domcontentloaded',
  })

  await page.waitForSelector('input[placeholder=Email')
  await page.type('input[placeholder=Email]', email, {
    delay: 100,
  })

  await page.waitForSelector('input[placeholder=Password]')
  await page.type('input[placeholder=Password]', password, {
    delay: 100,
  })

  const [response] = await Promise.all([
    page.waitForNavigation({ timeout: 30000 }),
    page.click('button[type=submit]', { delay: 500 }),
    page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(
            'https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPasswor',
          ) && response.status() === 200,
    ),
  ])
}

// const handleVcc = async (page) => {

// }

// enhanced processes
const enhancedLogin = enhance('handle login', handleLogin)
// const enhandedHandleVcc = enhance('handle Vcc', handleVcc)
const enhancedHandleProxyType = enhance('handle proxy type', handleProxyType)

const handleAutoProcesses = async (account) => {
  let page
  let browser

  for (let retryNumber = 1; retryNumber <= maxRetryNumber; retryNumber++) {
    await sleep(getRandom(2000, 4000))

    const options = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--incognito',
    ]

    const data = await generateData(account)

    if (proxies.length > 0) {
      const proxy = getRandomFromArr(proxies, 1)[0]

      const [ip, port] = proxy.split(':')

      options.push(`--proxy-server=${ip}:${port}`)
      data.usedProxy = proxy
    }

    browser = await puppeteer.launch({
      headless,
      args: options,
    })
    page = (await browser.pages())[0]
    const cloakedPage = puppeteerCloak(page)

    // block images and fonts
    await optimize(page)
    await page.setViewport({
      width: 800,
      height: 600,
      deviceScaleFactor: 1,
    })

    await enhancedHandleProxyType(page, data.usedProxy)

    try {
      await enhancedLogin(page, data.account.email, data.account.password)
      // await enhandedHandleVcc(page)

      // handle vcc
      await page.waitForTimeout(2000)
      await page.goto('https://unitedmasters.com/membership', {
        waitUntil: 'load',
      })

      await page.waitForXPath(
        "//button[contains(., 'Start free 14-day trial')]",
      )
      const freeTrialButtons = await page.$x(
        "//button[contains(., 'Start free 14-day trial')]",
      )
      const correctFreeTrialButton = freeTrialButtons[0]

      await Promise.all([
        page.waitForNavigation(),
        correctFreeTrialButton.click({ delay: 200 }),
      ])
      await page.waitForTimeout(2000)

      const vcc = await getRandomVcc()
      console.log('watch me vcc', vcc)

      let { cardNumber, cardName, expiry, cvc } = vcc
      let input
      await page.waitForSelector('input[id=cardNumber]')
      input = await page.$('input#cardNumber')
      await input.click({ clickCount: 3, delay: 50 })
      await page.type('input[id=cardNumber]', cardNumber, {
        delay: 100,
      })

      await page.waitForSelector('input[id=cardExpiry]')
      input = await page.$('input#cardExpiry')
      await input.click({ clickCount: 3, delay: 50 })
      await page.type('input[id=cardExpiry]', expiry, {
        delay: 100,
      })

      await page.waitForSelector('input[id=cardCvc]')
      input = await page.$('input#cardCvc')
      await input.click({ clickCount: 3, delay: 50 })
      await page.type('input[id=cardCvc]', cvc, {
        delay: 100,
      })

      await page.waitForSelector('input[id=billingName]')
      input = await page.$('input#billingName')
      await input.click({ clickCount: 3, delay: 50 })
      await page.type('input[id=billingName]', cardName, {
        delay: 100,
      })

      await page.waitForTimeout(2000)

      const newSelectedCountry = getRandomFromArr(ramdomCountriesToSelect, 1)[0]
      await page.select('select[id=billingCountry]', newSelectedCountry)

      await page.waitForTimeout(2000)

      await page.waitForXPath("//span[contains(., 'Start trial')]")
      const startFreeTrialButtons = await page.$x(
        "//span[contains(., 'Start trial')]",
      )
      const correctStartFreeTrialButton = startFreeTrialButtons[0]

      await Promise.all([
        page.waitForNavigation({ timeout: 25000 }),
        correctStartFreeTrialButton.click({ delay: 200 }),
      ])

      await page.waitForTimeout(2000)

      // push to usedData and remove from errorData if exist
      usedData.push(data)
      errorData = errorData.filter(
        (da) => da.account.email !== data.account.email,
      )
      if (!devMode) {
        await browser.close()
      }
      break
    } catch (error) {
      // add to error data if not exist
      console.log('*** ERROR FOUND ***')
      if (retryNumber === maxRetryNumber) {
        console.log('reach maxRetryNumber while adding card')
      }
      if (errorData.every((da) => da.account.email !== data.account.email)) {
        errorData.push(data)
      }
      await browser.close()
    }
  }
}

// enhance handle all
const enhancedHandleAutoProcesses = enhance(
  'handle one auto process',
  handleAutoProcesses,
)

// GIVE ME ATTENTION PLSS
;(async () => {
  startNoti()
  console.log('-----HANDLE FRESH DATA START-----')
  try {
    for (const account of accounts) {
      await enhancedHandleAutoProcesses(account)
      await handleSaveReportAndRemove()

      await sleep(1500)
    }
  } catch (error) {
    console.log('HANDLE FRESH DATA ERROR: ', error)
  }
  console.log('-----HANDLE FRESH DATA END-----')

  endNoti()
})()
