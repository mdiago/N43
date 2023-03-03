# N43
Lectura de archivos de movimientos bancarios según las especificaciones de la AEB en las serie normas y procedimientos bancarios 43.

## Ejemplo de utilización

```javascript

// Creamos el objeto N43.File
var fileN43 = new N43.File({ Text: fileText });

// Devolvemos el resultado procesado
var transactionsResult = fileN43.GetTransactions();

```
