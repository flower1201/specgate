export function greet(name = "world") {
  return `hello, ${name}`;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("index.js")) {
  console.log(greet("specgate"));
}
