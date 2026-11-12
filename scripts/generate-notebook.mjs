// The web laboratory is the single source of the twelve educational cells.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const source = await readFile(new URL('../frontend/src/laboratory.ts', import.meta.url), 'utf8');
const { cells } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const notebook = {
  nbformat: 4, nbformat_minor: 5,
  metadata: {kernelspec: {display_name:'Python 3',language:'python',name:'python3'}},
  cells: [
    {id:'intro',cell_type:'markdown',metadata:{},source:['# SIMURGENCIAS · Entrega 1\nDatos sintéticos, modelo académico.\nInstalar las dependencias de backend/requirements-lab.txt. La celda de importaciones localiza backend automáticamente al abrir este cuaderno desde el proyecto.\nEn Colab: clonar el repositorio e instalar las dependencias antes de ejecutar.']},
    ...cells.flatMap((cell, index) => [
      {id:`text-${index}`,cell_type:'markdown',metadata:{},source:[`## ${index+1}. ${cell.title}\n${cell.text}`]},
      {id:`code-${index}`,cell_type:'code',metadata:{},execution_count:null,outputs:[],source:cell.code.split('\n').map(line=>line+'\n')},
    ]),
  ],
};
await mkdir(new URL('../notebooks/', import.meta.url), {recursive:true});
await writeFile(new URL('../notebooks/SIMURGENCIAS_Entrega_1.ipynb', import.meta.url), JSON.stringify(notebook, null, 2)+'\n');
console.log('Cuaderno generado: 12 celdas de código y sus explicaciones.');
