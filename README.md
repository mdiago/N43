# N43
Lectura de archivos de movimientos bancarios según las especificaciones de la AEB en las serie normas y procedimientos bancarios 43.

En el siguiente enlace puede encontrar un [ejemplo de uso](https://mdiago.github.io/N43/index.html).

## Ejemplo de utilización

```JavaScript

// Creamos el objeto N43.File
var fileN43 = new N43.File({ Text: fileText });

// Devolvemos el resultado procesado
var transactionsResult = fileN43.GetTransactions();

```
