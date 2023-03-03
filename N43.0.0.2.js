/* N43 0.0.2
 * ©2023 Irene Solutions SL
 */

/**
 * @summary     N43
 * @description Programa para la lectura de archivos de movimientos bancarios
 *              según las especificaciones de la AEB en las serie normas y 
 *              procedimientos bancarios 43.
 * @version     0.0.0
 * @file        N43.0.0.2.js
 * @author      Irene Solutions SL
 * @contact     support@irenesolutions.com
 * @copyright   Copyright 2023 Irene Solutions SL.
 *
 * This source file is free software, available under the following license:
 *   GNU Affero General Public License - http://www.gnu.org/licenses
 *
 * This source file is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE. See the license files for details.
 *
 * For details please refer to: http://www.irenesolutions.com
 */

// Creación espacios de nombres

/**
 * Gestión der archivos de norma 43.
 * @namespace N43
 * */
var N43 = N43 || {};

/**
 * Representa un archivo de norma 43.
 * @class N43.File
 * @example
 * var fileN43 = new N43.File({ Text: 'texto del archivo'});
 */
N43.File = class {

    // Private fields
    #Options = null;
    #RawTextLines = null;
    #Headers = null;
    #AccountEnds = null;
    #FileEnd = null;
    #RawTransactions = [];

    // Public fields
    Records = [];

    /**
     * Constructor archivo de norma 43.
     * @constructor
     * @param {object} options Parámetros de la transacción. Admite un objeto con las propiedades de la clase
     * para inicializar sus valores.
     * @example
    * var fileN43 = new N43.File({ Text: 'texto del archivo'});
     */
    constructor(options) {

        this.#Options = Object.assign(
            {
                Text: null
            },
            options
        );

        this.#RawTextLines = this.#Options.Text.split("\n");

        this.#RawTextLines.forEach((rawTextLine) => {

            if (rawTextLine)
                this.Records.push(new N43.Record({ Text: rawTextLine }));

        });

        this.#Headers = this.GetRecordsByTypeName(['CabeceraDeCuenta']);
        this.#AccountEnds = this.GetRecordsByTypeName(['FinalDeCuenta']);
        this.#FileEnd = this.GetRecordsByTypeName(['FinalDeFichero'])[0];

        for (let h = 0; h < this.#Headers.length; h++) {

            var header = this.#Headers[h];
            var accountEnd = this.#AccountEnds[h];

            var startIndex = this.GetRecordIndex(header);
            var endIndex = this.GetRecordIndex(accountEnd);

            let currentMovement = null;

            for (let i = startIndex; i <= endIndex; i++) {

                let record = this.Records[i];

                switch (record.RecordType) {

                    case 'Movimiento':

                        if (currentMovement)
                            this.#RawTransactions.push(currentMovement);

                        let mult = record.Fields['Clave Debe o Haber'].Value === "1" ? -1 : 1;

                        currentMovement =
                        {
                            HeaderIndex: h,
                            BookingDate: record.Fields['Fecha operación'].Value,
                            ValueDate: record.Fields['Fecha valor'].Value,
                            RemittanceInformationUnstructured: [(record.Fields['Concepto propio'].Value + " " + [N43.Concepts[record.Fields['Concepto común'].Value]]).trim()],
                            Currency: header.Currency,
                            Amount: mult * record.Fields['Importe'].Value,
                            DocumentCurrency: header.Currency,
                            DocumentAmount: mult * record.Fields['Importe'].Value
                        };

                        break;
                    case 'ComplementarioConcepto':

                        if (currentMovement) {

                            let concepto = record.Fields['Concepto 1'].Value.trim();

                            if (concepto)
                                currentMovement.RemittanceInformationUnstructured.push(concepto);

                            concepto = record.Fields['Concepto 2'].Value.trim();

                            if (concepto)
                                currentMovement.RemittanceInformationUnstructured.push(concepto);

                        }

                        break;

                    case 'ComplementarioImporte':

                        if (currentMovement) {

                            let divisa = record.Fields['Clave divisa origen del movimiento'].Value.trim();
                            let currency = N43.Currencies[divisa];

                            if (currency !== currentMovement.Currency) {
                                currentMovement.DocumentCurrency = divisa;
                                currentMovement.DocumentAmount = record.Fields['Importe'].Value;

                            };

                        }

                        break;

                };

            }

            if (currentMovement)
                this.#RawTransactions.push(currentMovement);

        }    

    }

    /**
     * Orden de las transacciones.
     * @returns {Number} Devuelve 1 para asc y -1 para desc.
     * */
    get OrderType() {

        var sumDiffDates = 0;

        this.#RawTransactions.forEach((current, index, arr) => {

            if (index > 0 && index < arr.length - 2) 
                sumDiffDates += arr[index].BookingDate.valueOf() - arr[index - 1].BookingDate.valueOf();

        });

        return sumDiffDates / Math.abs(sumDiffDates);

    }

    /**
     * Texto del archivo sin tratar.
     * */
    get RawText() {

        return this.#Options.Text;

    }

    /**
     * Líneas de texto del archivo sin tratar
     * */
    get RawTextLines() {

        return this.#RawTextLines;

    }

    /**
    * Cálculo digito de control
     */
    get DigitControls() {

        var digitControls = [];

        for (let h = 0; h < this.#Headers.length; h++)
        {

            var header = this.#Headers[h];

            let clave = header.Fields['Clave de la Entidad'].RawText + header.Fields['Clave de Oficina'].RawText;
            let factors = [4, 8, 5, 10, 9, 7, 3, 6];

            let sumProducts = 0;

            factors.forEach((factor, index) => { sumProducts += parseInt(clave[index]) * factor; });

            let control = 11 - (sumProducts % 11);

            sumProducts = 0;
            clave = header.Fields['Nº de cuenta'].RawText;
            factors = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];
            factors.forEach((factor, index) => { sumProducts += parseInt(clave[index]) * factor; });

            digitControls.push('' + control + (11 - (sumProducts % 11)));

        }

        return digitControls;

    }

    /**
    * Encabezado
     */
    get Headers() {

        var headers = [];

        for (let h = 0; h < this.#Headers.length; h++)
        {

            var header = this.#Headers[h];
            var accountEnd = this.#AccountEnds[h];

            headers.push({
                AccountId: `${header.Fields['Clave de la Entidad']}` +
                    `${header.Fields['Clave de Oficina']}${this.DigitControls[h]}` +
                    `${header.Fields['Nº de cuenta']}`,
                BankId: `${header.Fields['Clave de la Entidad']}`,
                Currency: N43.Currencies[`${header.Fields['Clave de divisa']}`],
                BalanceStart: (this.OrderType === 1) ?
                    header.Fields['Importe saldo inicial'].Value : accountEnd.Fields['Saldo final'].Value,
                BalanceEnd: (this.OrderType === 1) ?
                    accountEnd.Fields['Saldo final'].Value : header.Fields['Importe saldo inicial'].Value,
                BalanceVariation: parseFloat((accountEnd.Fields['Saldo final'].Value -
                    header.Fields['Importe saldo inicial'].Value).toFixed(2))
            });

        }

        return headers;

    }

    /**
     * Recupera los registros correspondientes.
     * @param {Array} typeNames Nombres de tipos de registro.
     * @returns {Array} Colección de registros del tipo de registro.
     */
    GetRecordsByTypeName(typeNames) {

        return this.Records.filter((record) => {
            return typeNames.indexOf(record.RecordType) !== -1;
        });

    }

    /**
     * Devuelve el índice del registro facilitado como parámetro.
     * @param {Record} record Registro de archivo norma 43.
     * @returns {Number} Indice del registro en la colección.
     */
    GetRecordIndex(record) {

        return this.Records.indexOf(record);

    }

    /**
     * Devuelve una colección de transacciones a partir
     * de los datos del fichero de norma 43.
     * @returns {Objet} Resultado de transacciones.
     */
    GetTransactions() {

        let results = [];

        for (let h = 0; h < this.#Headers.length; h++)
        {

            var header = this.Headers[h];

            let result = Object.assign({}, header);
            result.Transactions = [];

            let transactionsAmount = 0;
            let balance = header.BalanceStart;

            for (let t = 0; t < this.#RawTransactions.length; t++) {

                let rawTransaction = this.#RawTransactions[t];

                if (rawTransaction.HeaderIndex === h) {

                    let transaction = {};
                    let info = rawTransaction.RemittanceInformationUnstructured.join(" ");

                    Object.assign(transaction, rawTransaction);
                    transaction.RemittanceInformationUnstructured = info;

                    transactionsAmount += transaction.Amount;
                    balance += transaction.Amount;

                    transaction.Balance = parseFloat(balance.toFixed(2));
                    transaction.Order = t + 1;

                    result.Transactions.push(transaction);

                }

            }

            result.TransactionsAmount = parseFloat(transactionsAmount.toFixed(2));

            if (this.OrderType === -1) {

                // Orden descendente, reverse y recalculo saldo
                result.Transactions.reverse();

                balance = header.BalanceStart;
                transactionsAmount = 0;

                for (let t = 0; t < result.Transactions.length; t++) {

                    var transaction = result.Transactions[t];

                    transactionsAmount += transaction.Amount;
                    balance += transaction.Amount;

                    transaction.Balance = parseFloat(balance.toFixed(2));
                    transaction.Order = t + 1;                                      

                }

            }

            results.push(result);

        }

        return results;

    }

    /**
     * Representación textual de la instancia.
     * */
    toString() {

        return `(${this.#RawTextLines.length}) ${this.#RawTextLines}`;

    }

}

/**
 * Representa un registro de un archivo de norma 43.
 * @class N43.Record
 * @property {object} RecordTypes Enumeración tipos de registro.
 * @property {string} RecordType Tipo de registro.
 * @example
 * var recordN43 = new N43.Record({ Text: 'texto del archivo'});
 */
N43.Record = class {

    // Private instance fields.

    #Options = null;
    #RawTextLine = null;

    // Public instance fields

    /**
     * Tipo de registro.
     * */
    RecordType = null;

    /**
     * Tipos de registro.
     * @readonly
     * @enum {string}
     */
    RecordTypes = {

        /**
         * Registro de cabecera de cuenta.
         * */
        CabeceraDeCuenta: "11",

        /**
         * Registro principal de movimientos.
         * */
        Movimiento: "22",

        /**
         * Registros complementarios de concepto.
         * */
        ComplementarioConcepto: "23",

        /**
         * Registro complementario de información
         * de equivalencia de importe del apunte.
         * */
        ComplementarioImporte: "24",

        /**
         * Registro final de la cuenta
         * */
        FinalDeCuenta: "33",

        /**
         * Registro final de fichero
         * */
        FinalDeFichero: "88"


    };

    /**
     * Campos.
     * */
    Fields = {};

    /**
     * Constructor archivo de norma 43.
     * @constructor
     * @param {object} options Parámetros de la transacción. Admite un objeto con las propiedades de la clase
     * para inicializar sus valores.
     * @example
    * var fileN43 = new N43.File({ Text: 'texto de la línea'});
     */
    constructor(options) {

        this.#Options = Object.assign(
            {
                Text: null
            },
            options
        );

        this.#RawTextLine = this.#Options.Text;

        let firstField = new N43.RecordField({ Text: this.#RawTextLine });

        this.Fields[firstField.Name] = firstField;

        var recordTypeCode = '' + this.Fields[firstField.Name].Value;

        Object.keys(this.RecordTypes).forEach((recordType) => {
            if (this.RecordTypes[recordType] === recordTypeCode)
                this.RecordType = recordType;

        });

        if (!N43.RecordFieldSets[this.RecordType])
            throw { Code: 100, Error: `No definition for RecordType ${this.RecordType}` };

        N43.RecordFieldSets[this.RecordType].forEach((field) => {

            let recordField = new N43.RecordField({ Text: this.#RawTextLine, Field: field });
            this.Fields[recordField.Name] = recordField;

        });

    }

    /**
     * Texto del archivo sin tratar.
     * */
    get RawText() {

        return this.#Options.Text;

    }

    /**
     * Líneas de texto del archivo sin tratar
     * */
    get RawTextLine() {

        return this.#RawTextLine;

    }

    /**
     * Código tipo de registro.
     * */
    get RecordTypeCode() {

        return this.RecordTypes[RecordType];

    }

    /**
     * Representación textual de la instancia.
     * */
    toString() {

        return `(${this.RecordType}) ${this.RawTextLine}`;

    }

}

/**
 * Representa un campo de un registro de archivo de norma 43.
 * @class N43.Field
 * @example
 * var fieldN43 = new N43.Field({ Name: 'Código Registro',From: 1,To: 2, Format: 'N'});
 */
N43.Field = class {

    #Options = null;

    /**
     * Constructor archivo de norma 43.
     * @constructor
     * @param {object} options Parámetros de la transacción. Admite un objeto con las propiedades de la clase
     * para inicializar sus valores.
     * @example
    * var fileN43 = new N43.Field({ Name: 'Código Registro',From: 1,To: 2, Format: 'N'});
     */
    constructor(options) {

        this.#Options = Object.assign(
            {
                Name: 'Código Registro',
                From: 1,
                To: 2,
                Format: "N"
            },
            options
        );

    }

    /**
    * Nombre del campor en las especificaciones
    * de la asociación española de banca.
    * */
    get Name() {

        return this.#Options.Name;

    };

    /**
    * Punto inicial de la línea de registro
    * que correponde al campo en base 1.
    * */
    get From() {

        return this.#Options.From;

    };

    /**
    * Punto final de la línea de registro
    * que correponde al campo en base 1.
    * */
    get To() {

        return this.#Options.To;

    };
    /**
    * Formato del tipo de datos.
    * */
    get Format() {

        return this.#Options.Format;

    };


    /**
    * Longitud del campo.
    * */
    get Length() {

        return this.#Options.From - this.#Options.To + 1;

    };

    /**
     * Longitud del campo.
     * */
    get Length() {

        return this.To - this.From + 1;

    };

    /**
     * Devuelve el texto correspondiente al
     * campo en una línea de registro.
     * @param {string} lineText Texto línea de registro.
     * */
    ReadRawText(lineText) {

        return lineText.substring(this.From - 1, this.To);

    }

    /**
     * Valor
     * */
    Value(lineText) {

        let rawText = this.ReadRawText(lineText);

        let converters = {
            N: (text) => {
                return text;
            },
            A: (text) => {
                return text;
            },
            D: (text) => {
                return parseFloat(text) / 100;
            },
            F: (text) => {
                let year = new Date().toISOString().substr(0, 2) + text.substr(0, 2);
                let month = text.substr(2, 2);
                let day = text.substr(4, 2);
                let jsonDate = `${year}-${month}-${day}T00:00:00Z`;
                return new Date(jsonDate);
            },
            I: (text) => {
                return parseInt(text);
            }
        };

        return converters[this.Format](rawText);

    };

    /**
     * Representación textual de la instancia.
     * */
    toString() {

        return `(${this.Name}, ${this.Format}) ${this.From}-${this.To}`;

    }

}

/**
 * Representa un campo en un registro determinado
 * correspondiente a una línea de archivo de norma 43.
 * @class N43.RecordField
 * @example
 * var recordFieldN43 = new N43.RecordField({ Text: 'texto de la línea'});
 */
N43.RecordField = class {

    #Options = null;
    #RawTextLine = null;

    /**
     * Constructor un campo en un registro determinado
     * correspondiente a una línea de archivo de norma 43.
     * @constructor
     * @param {object} options Parámetros de la transacción. 
     * Admite un objeto con las propiedades de la clase
     * para inicializar sus valores.
     * @example
    * var recordFieldN43 = new N43.RecordField({ Text: 'texto de la línea'});
     */
    constructor(options) {

        this.#Options = Object.assign(
            {
                Text: null,
                Field: new N43.Field()
            },
            options
        );

        this.#RawTextLine = this.#Options.Text;

    }

    /**
     * Campo.
     * */
    get Field() {

        return this.#Options.Field;

    }

    /**
     * Nombre.
     * */
    get Name() {

        return this.Field.Name;

    }

    /**
     * Texto del campo sin tratar.
     * */
    get RawText() {

        return this.Field.ReadRawText(this.#RawTextLine);

    }

    /**
     * Valor del campo.
     * */
    get Value() {

        return this.Field.Value(this.#RawTextLine);

    }

    /**
     * Representación textual de la instancia.
     * */
    toString() {

        return `${this.Value}`;

    }

}

/**
 * Definición de los tipos de registro.
 * */
N43.RecordFieldSets = {

    /**
     * Registro de cabecera de cuenta.
     * */
    CabeceraDeCuenta: [
        new N43.Field({ Name: 'Clave de la Entidad', From: 3, To: 6, Format: 'N' }),
        new N43.Field({ Name: 'Clave de Oficina', From: 7, To: 10, Format: 'N' }),
        new N43.Field({ Name: 'Nº de cuenta', From: 11, To: 20, Format: 'N' }),
        new N43.Field({ Name: 'Fecha inicial', From: 21, To: 26, Format: 'F' }),
        new N43.Field({ Name: 'Fecha final', From: 27, To: 32, Format: 'F' }),
        new N43.Field({ Name: 'Clave Debe o Haber', From: 33, To: 33, Format: 'N' }),
        new N43.Field({ Name: 'Importe saldo inicial', From: 34, To: 47, Format: 'D' }),
        new N43.Field({ Name: 'Clave de divisa', From: 48, To: 50, Format: 'N' }),
        new N43.Field({ Name: 'Modalidad de información', From: 51, To: 51, Format: 'N' }),
        new N43.Field({ Name: 'Nombre abreviado', From: 52, To: 77, Format: 'A' }),
        new N43.Field({ Name: 'Libre', From: 78, To: 80, Format: 'A' })
    ],

    /**
     * Registro principal de movimientos.
     * */
    Movimiento: [
        new N43.Field({ Name: 'Libre', From: 3, To: 6, Format: 'N' }),
        new N43.Field({ Name: 'Clave de Oficina Origen', From: 7, To: 10, Format: 'A' }),
        new N43.Field({ Name: 'Fecha operación', From: 11, To: 16, Format: 'F' }),
        new N43.Field({ Name: 'Fecha valor', From: 17, To: 22, Format: 'F' }),
        new N43.Field({ Name: 'Concepto común', From: 23, To: 24, Format: 'N' }),
        new N43.Field({ Name: 'Concepto propio', From: 25, To: 27, Format: 'N' }),
        new N43.Field({ Name: 'Clave Debe o Haber', From: 28, To: 28, Format: 'N' }),
        new N43.Field({ Name: 'Importe', From: 29, To: 42, Format: 'D' }),
        new N43.Field({ Name: 'Nº de documento', From: 43, To: 52, Format: 'N' }),
        new N43.Field({ Name: 'Referencia 1', From: 53, To: 64, Format: 'N' }),
        new N43.Field({ Name: 'Referencia 2', From: 65, To: 80, Format: 'A' })
    ],

    /**
     * Registros complementarios de concepto.
     * */
    ComplementarioConcepto: [
        new N43.Field({ Name: 'Código Dato', From: 3, To: 4, Format: 'N' }),
        new N43.Field({ Name: 'Concepto 1', From: 5, To: 42, Format: 'A' }),
        new N43.Field({ Name: 'Concepto 2', From: 43, To: 80, Format: 'A' })
    ],

    /**
     * Registro complementario de información
     * de equivalencia de importe del apunte.
     * */
    ComplementarioImporte: [
        new N43.Field({ Name: 'Código Dato', From: 3, To: 4, Format: 'N' }),
        new N43.Field({ Name: 'Clave divisa origen del movimiento', From: 5, To: 7, Format: 'N' }),
        new N43.Field({ Name: 'Importe', From: 8, To: 21, Format: 'D' }),
        new N43.Field({ Name: 'Libre', From: 22, To: 80, Format: 'N' })
    ],

    /**
     * Registro final de la cuenta
     * */
    FinalDeCuenta: [
        new N43.Field({ Name: 'Clave de la Entidad', From: 3, To: 6, Format: 'N' }),
        new N43.Field({ Name: 'Clave de Oficina', From: 7, To: 10, Format: 'N' }),
        new N43.Field({ Name: 'Nº de cuenta', From: 11, To: 20, Format: 'N' }),
        new N43.Field({ Name: 'Nº apuntes Debe', From: 21, To: 25, Format: 'N' }),
        new N43.Field({ Name: 'Total importes Debe', From: 26, To: 39, Format: 'D' }),
        new N43.Field({ Name: 'Nº apuntes Haber', From: 40, To: 44, Format: 'N' }),
        new N43.Field({ Name: 'Total importes Haber', From: 45, To: 58, Format: 'D' }),
        new N43.Field({ Name: 'Código Saldo final', From: 59, To: 59, Format: 'N' }),
        new N43.Field({ Name: 'Saldo final', From: 60, To: 73, Format: 'D' }),
        new N43.Field({ Name: 'Clave de Divisa', From: 74, To: 76, Format: 'N' }),
        new N43.Field({ Name: 'Libre', From: 77, To: 80, Format: 'A' })
    ],

    /**
    * Registro final de fichero
    * */
    FinalDeFichero: [
        new N43.Field({ Name: 'Nueves', From: 3, To: 20, Format: 'N' }),
        new N43.Field({ Name: 'Nº de registros', From: 21, To: 26, Format: 'I' }),
        new N43.Field({ Name: 'Libre', From: 27, To: 80, Format: 'A' })
    ],

};

/**
 * Definición de divisas.
 * */
N43.Currencies = {
    036: 'AUD',
    124: 'CAD',
    208: 'DKK',
    392: 'JPY',
    554: 'NZD',
    578: 'NOK',
    752: 'SEK',
    756: 'CHF',
    826: 'GBP',
    840: 'USD',
    978: 'EUR'
};

/**
 * Definición de conceptos.
 * */
N43.Concepts = {
    '01': 'TALONES - REINTEGROS',
    '02': 'ABONARÉS - ENTREGAS - INGRESOS',
    '03': 'DOMICILIADOS - RECIBOS - LETRAS - PAGOS POR SU CTA.',
    '04': 'GIROS - TRANSFERENCIAS - TRASPASOS - CHEQUES',
    '05': 'AMORTIZACIONES PRÉSTAMOS, CRÉDITOS, ETC.',
    '06': 'REMESAS EFECTOS',
    '07': 'SUSCRIPCIONES - DIV. PASIVOS - CANJES.',
    '08': 'DIV. CUPONES - PRIMA JUNTA - AMORTIZACIONES',
    '09': 'OPERACIONES DE BOLSA Y/O COMPRA /VENTA VALORES',
    '10': 'CHEQUES GASOLINA',
    '11': 'CAJERO AUTOMÁTICO',
    '12': 'TARJETAS DE CRÉDITO - TARJETAS DÉBITO',
    '13': 'OPERACIONES EXTRANJERO',
    '14': 'DEVOLUCIONES E IMPAGADOS',
    '15': 'NÓMINAS - SEGUROS SOCIALES',
    '16': 'TIMBRES - CORRETAJE - PÓLIZA',
    '17': 'INTERESES - COMISIONES – CUSTODIA - GASTOS E IMPUESTOS',
    '98': 'ANULACIONES - CORRECCIONES ASIENTO',
    '99': 'VARIOS'
};
