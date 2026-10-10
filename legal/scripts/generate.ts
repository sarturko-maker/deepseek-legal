/** Build-owned reflection for the independent legal plugin using the Harness generator. */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'
import { WorkspaceTypertGenerator } from '../../packages/typert/generator/src/workspace.ts'

const root = resolve(import.meta.dirname, '../..')
const aggregate = ts.readConfigFile(resolve(root, 'tsconfig.host.json'), ts.sys.readFile).config as {
  references: { path: string }[]
}
await mkdir(resolve(root, 'legal/lib'), { recursive: true })
await writeFile(resolve(root, 'legal/lib/tsconfig.generate.json'), JSON.stringify({
  extends: resolve(root, 'tsconfig.base.json'), files: [],
  references: [...aggregate.references.map(reference => ({ path: resolve(root, reference.path) })),
    { path: resolve(root, 'legal/tsconfig.host.json') }],
}))
const generator = new WorkspaceTypertGenerator(root, {
  hostConfig: 'legal/lib/tsconfig.generate.json', clientConfig: 'legal/lib/tsconfig.generate-client.json',
  packageDirectories: ['packages', 'legal'], checkDiagnostics: false,
})
const artifacts = generator.generate(['@deepseek-legal/redlining'], ['host'])
if (artifacts.length !== 1 || artifacts[0]?.remote === undefined) throw new Error('Legal Remote contribution was not generated.')
for (const artifact of artifacts) {
  const directory = resolve(root, artifact.packageRoot, 'lib')
  await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'typert.host.js'), artifact.js)
  await writeFile(resolve(directory, 'typert.host.d.ts'), artifact.dts)
  if (artifact.remote !== undefined) {
    await writeFile(resolve(directory, 'typert.remote-client.js'), artifact.remote.js)
    await writeFile(resolve(directory, 'typert.remote-client.d.ts'), artifact.remote.dts)
    await writeFile(resolve(directory, 'typert.remote-client.d.ts.map'), artifact.remote.dtsMap)
  }
}
