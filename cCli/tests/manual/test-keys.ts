// 检测终端按键的原始字节
// 运行: npx tsx tests/manual/test-keys.ts
// 按各种键看输出，Ctrl+C 退出

process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.setEncoding('utf-8')

console.log('按任意键查看原始数据（Ctrl+C 退出）：')
console.log('')

process.stdin.on('data', (data: string) => {
  const hex = Buffer.from(data).toString('hex').match(/.{2}/g)?.join(' ')
  const display = JSON.stringify(data)
  console.log(`raw: ${display.padEnd(20)} hex: ${hex}`)

  if (data === '\x03') process.exit(0) // Ctrl+C
})
