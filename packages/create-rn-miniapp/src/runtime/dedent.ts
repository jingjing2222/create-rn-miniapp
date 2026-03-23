import rawDedent from 'dedent'

function renderDedentedTemplate(strings: TemplateStringsArray, values: unknown[]) {
  const placeholders = values.map((_, index) => `\uE000CODEX_DEDENT_${index}\uE001`)
  let combined = strings[0] ?? ''

  for (let index = 0; index < values.length; index += 1) {
    combined += placeholders[index]
    combined += strings[index + 1] ?? ''
  }

  let dedented = rawDedent(combined)

  for (let index = 0; index < values.length; index += 1) {
    dedented = dedented.split(placeholders[index]).join(String(values[index]))
  }

  return dedented
}

export default function dedent(strings: TemplateStringsArray, ...values: unknown[]) {
  return renderDedentedTemplate(strings, values)
}

export function dedentWithTrailingNewline(strings: TemplateStringsArray, ...values: unknown[]) {
  return `${dedent(strings, ...values)}\n`
}
