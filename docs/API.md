# LONGi Meter — Smart Prepayment System Vending API

**Version:** V1.03  
**Publisher:** LONGI METER CO. LTD.  
**Date:** 2019-11-01  

**Product:** LONGiMeter — The most smart system for AMI and Vending.

All APIs return JSON. Base responses extend `ServiceBaseVo`. Base URL pattern: `http://ip:port/vendingservice/`.

---

## Chapter 1. API Return

All APIs return parameters of the `ServiceBaseVo` class (or its extensions). Interfaces return a JSON string.

### ServiceBaseVo (base class)

| Member   | Type   | Description      |
|----------|--------|------------------|
| errorCode| `int`  | Error code       |
| errorMsg | `String` | Error message  |

### Error codes

| Code | Constant | Message |
|------|----------|---------|
| 0 | SUCCESS | Success |
| 1001 | LOGIN_USERNAME_PASSWORD_EMPTY | — |
| 1003 | LOGOUT_TOKEN_NOTEXIST | Session expired / token not exist |
| 1004 | LOGIN_USER_NOTEXIST | User does not exist |
| 1005 | LOGIN_USER_PWDERROR | Password is not correct |
| 1006 | LOGIN_USER_STATUS_LOCK | User locked |
| 1007 | LOGIN_USER_DEADLINE | User deadline |
| 1008 | LOGIN_USER_MCH_NOTEXIST | User merchant not exist |
| 1009 | LOGIN_MCH_STATUS_LOCK | Merchant locked |
| 1010 | LOGIN_MCH_DEADLINE | Merchant deadline |
| 1011 | LOGIN_SESSION_STATUS | Session status error |
| 1012 | LOGIN_MCH_NOTSTART | Merchant not started |
| 2001 | METERINFO_MSNO_EMPTY | Meter number empty |
| 2002 | METERINFO_EMPTY | Meter information does not exist |
| 3001 | VENDING_ERROR | Inner error |
| 3002 | ORDER_EMPTY | Order empty |
| 3003 | GET_ORDERNO_FAILED | Get order number failed |
| 3004 | ORDERNO_EMPTY | Order number empty |
| 3005 | ORDERNO_NOTEXIST | Order number does not exist |
| 3006 | ORDER_ALREADY_CANCELED | Order already canceled |
| 3007 | ORDER_STATE_ERROR | Order state error |
| 3008 | NO_DATA | No data |
| 3100 | METER_STATUS_NOT_ACTIVE | Meter status not active |
| 3101 | MERCHANT_NOT_ACTIVE | Merchant not active |
| 3102 | CREDIT_AMOUNT_BELOW_MIN_AMOUNT | Credit amount below minimum |
| 3103 | CREDIT_AMOUNT_MORE_THAN_MAX_AMOUNT | Credit amount more than maximum |
| 3104 | CREDIT_AMOUNT_MERCHANT_NOT_ENOUGH | Merchant credit not enough |
| 3105 | METER_TYPE_NOT_PREPAY_METER | Meter type not prepayment |
| 3106 | KEY_EXPIRED_OR_NOT_CONFIGED | Key expired or not configured |
| 3107 | MONEY_NOT_ENOUGH_FOR_FEE | Money not enough for fee |
| 3108 | MAKE_TOKEN_FAILED | Make token failed |
| 3109 | METER_PARAMETER_WRONG | Meter parameter wrong |
| 3110 | GET_CHANGE_TOKEN_FAILED | Get change token failed |
| 3111 | TARIFF_NOT_CONFIG | Tariff not configured |
| 3112 | TARIFF_CONFIG_WRONG | Tariff configuration wrong |
| 3116 | PURCHASE_AMOUNT_IS_LESS_THAN_REPAY_DEBT | Purchase amount less than repay debt |
| 3120 | STS_SERVICE_CONNECT_WRONG | STS service connect wrong |
| 3121 | SAVE_ORDER_FAILED | Save order failed |
| 3122 | SAVE_ORDER_DETAIL_FAILED | Save order detail failed |
| 3123 | SAVE_ORDER_STEP_FAILED | Save order step failed |
| 3124 | UPDATE_MERCHANT_CREDIT_FAILED | Update merchant credit failed |
| 3125 | UPDATE_METER_MONTH_PURCHASE_FAILED | Update meter month purchase failed |
| 3126 | SAVE_CHANGEKEY_ORDER_FAILED | Save change key order failed |
| 3127 | UPDATE_METER_STS_KEY_PARAM_FAILED | Update meter STS key param failed |
| 3130 | CANT_BUY_ENERGY_LESS_THAN_ZERO | Cannot buy energy less than zero |
| 3135 | POC_DOSENT_CONNECT_SUPPLY_GROUP | POC doesn't connect supply group |
| 9001 | PARAM_TOKEN_EMPTY | Token parameter empty |
| 9002 | PARAM_MSNO_EMPTY | Meter number parameter empty |
| 9003 | PARAM_START_END_EMPTY | Start/end parameter empty |
| 9004 | PARAM_ORDNO_EMPTY | Order number parameter empty |
| 9005 | PARAM_AMOUNT_EMPTY | Amount parameter empty |
| 9006 | PARAM_PAYMETHOD_ERROR | Pay method parameter error |
| 9007 | PARAM_CLASSID_ERROR | Class ID parameter error |
| 9008 | PARAM_SIGNDATA_ERROR | Sign data parameter error |
| 9009 | PARAM_PAYAMOUNT_CHANGEAMOUNT_WRONG | Pay amount / change amount wrong |
| 9010 | PARAM_CARDPASSWORD_EMPTY | Card password empty |
| 9011 | PARAM_CARDNO_EMPTY | Card number empty |
| 9012 | PARAM_TOKEN_ERROR | Token parameter error |

---

## Chapter 2. Login

Login with the operator account. Session ID (token) is required for other functions.

### Endpoint

```
GET http://ip:port/vendingservice/login?username=${username}&password=${password}
```

### Request parameters

| Name     | Type    | In  | Description                          |
|----------|---------|-----|--------------------------------------|
| username | String  | Query | Operator account name              |
| password | String  | Query | MD5 signature of operator password |

### Response: ServiceBaseVo / LoginResponse

| Field           | Type      | Description                                |
|-----------------|-----------|--------------------------------------------|
| sessionId       | String    | Session ID (token) for subsequent requests |
| userName        | String    | Operator account name                      |
| loginTime       | String    | Login time, UTC datetime                   |
| merchantName    | String    | Merchant name                              |
| merchantBalance | BigDecimal| Merchant balance                           |
| vendminpertime  | BigDecimal| Minimum limit for vending per time         |
| vendmaxpertime  | BigDecimal| Maximum limit for vending per time         |
| merchantContact | String    | Merchant contact                           |
| merchantTel     | String    | Merchant contact number                    |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": "",
  "sessionID": "3ca7eaacf6224ffda37bc5457892abf2",
  "userName": "xxxx",
  "loginTime": "2019-11-11 10:29:28",
  "merchantName": "MerchantTest",
  "merchantBalance": 19654,
  "vendminpertime": 10,
  "vendmaxpertime": 500,
  "merchantContact": "210002",
  "merchantTel": "210002"
}
```

### Example: failure

```json
{
  "errorCode": 1005,
  "errorMsg": "Password is not correct"
}
```

### Possible error codes

0, 1001, 1004, 1005

---

## Chapter 3. Logout

Logout from the system.

### Endpoint

```
GET http://ip:port/vendingservice/logout?token=${token}
```

### Request parameters

| Name  | Type   | In   | Description                     |
|-------|--------|------|---------------------------------|
| token | String | Query| Session ID from login response |

### Response

Standard `ServiceBaseVo`.

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": ""
}
```

### Example: failure

```json
{
  "errorCode": 1003,
  "errorMsg": "The session has expired"
}
```

### Possible error codes

1003, 1011, 9001

---

## Chapter 4. Get Balance

Get merchant balance for the operator’s merchant.

### Endpoint

```
GET http://ip:port/vendingservice/balance?token=${token}
```

### Request parameters

| Name  | Type   | In   | Description                     |
|-------|--------|------|---------------------------------|
| token | String | Query| Session ID from login response |

### Response: ServiceBaseVo / BalanceResponse

| Field           | Type      | Description                          |
|-----------------|-----------|--------------------------------------|
| name            | String    | Merchant name                        |
| startTime       | Date      | Effective date, UTC datetime         |
| endTime         | Date      | Expiration date, UTC datetime        |
| creditAmount    | BigDecimal| Merchant balance                     |
| creditLimit     | BigDecimal| Merchant balance limit               |
| vendMinPertime  | BigDecimal| Minimum limit for vending per time   |
| vendMaxPertime  | BigDecimal| Maximum limit for vending per time   |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": "",
  "name": "MerchantTest",
  "startTime": "2019-10-22 00:00:00",
  "endTime": "2019-12-31 00:00:00",
  "creditAmount": 19654,
  "creditLimit": 300,
  "vendMinPertime": 10,
  "vendMaxPertime": 500
}
```

### Possible error codes

1003, 9001

---

## Chapter 5. Validation

Check meter information before vending.

### Endpoint

```
GET http://ip:port/vendingservice/validation?meterNo=${meterNo}&token=${token}
```

### Request parameters

| Name    | Type   | In   | Description                     |
|---------|--------|------|---------------------------------|
| meterNo | String | Query| Meter number                    |
| token   | String | Query| Session ID from login response |

### Response: ServiceBaseVo / ValidationResponse

| Field            | Type   | Description                                |
|------------------|--------|--------------------------------------------|
| meterNo          | String | Meter number                               |
| meterType        | int    | -1: Postpay; 0: Prepay electricity (kWh); 1: Prepay water (m³); 4: Prepay electricity (currency); 5: Prepay water (currency) |
| customerName     | String | Customer name                              |
| customerAddress  | String | Customer address                           |
| latestVendingDate| Date   | Latest vending date, UTC datetime          |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": null,
  "meterNo": "70000003130",
  "meterType": 0,
  "customerName": "STS 70000003130",
  "customerAddress": "Jiangcunshangwuzhongxin 8th",
  "latestVendingDate": "2019-11-05 17:56:55"
}
```

### Example: failure

```json
{
  "errorCode": 2002,
  "errorMsg": "The meter information does not exist"
}
```

### Possible error codes

1003, 2001, 2002, 9001

---

## Chapter 6. Generate Transaction

Deduct stock by the customer’s predefined amount and return the recharge token.

### Endpoint

```
GET http://ip:port/vendingservice/transaction?token=${token}&orderNo=${orderNo}&meterNo=${meterNo}&amount=${amount}
```

### Request parameters

| Name    | Type      | In   | Description                                    |
|---------|-----------|------|------------------------------------------------|
| token   | String    | Query| Session ID from login response                 |
| orderNo | String    | Query| Transaction ID from API GetorderNo (Ch. 7)     |
| meterNo | String    | Query| Meter number                                   |
| amount  | BigDecimal| Query| Customer’s predefined amount                   |

### Response: ServiceBaseVo / TransactionResponse

| Field          | Type       | Description                          |
|----------------|------------|--------------------------------------|
| orderNo        | String     | Transaction / order ID               |
| meterNo        | String     | Meter number                         |
| customerName   | String     | Customer name                        |
| sgc            | int        | SGC                                  |
| ti             | int        | TI                                   |
| amount         | BigDecimal | Actual payment                       |
| creditAmount   | BigDecimal | Amount for credit                    |
| debtAmount     | BigDecimal | Amount for debt repayment            |
| feeAmount      | BigDecimal | Amount for fee                       |
| credit         | BigDecimal | Credit (units for recharging)        |
| kctToken1      | String     | KCT first token (may be empty)       |
| kctToken2      | String     | KCT second token (may be empty)      |
| token          | String     | Recharge token, 20 digits            |
| operator       | String     | Operator name                        |
| merchant       | String     | Merchant name                        |
| feeDetail      | List&lt;Fee&gt;  | Fee details                    |
| priceDetail    | List&lt;Price&gt;| Price details                   |
| debtDetail     | List&lt;Debt&gt; | Debt details                    |
| subsidyToken   | String     | Subsidy token, 20 digits (may be empty) |
| subsidyCredit  | BigDecimal | Subsidy credit (may be empty)        |

#### Fee

| Field     | Type      | Description |
|-----------|-----------|-------------|
| feeType   | int       | 1: Fixed charge with transaction amount ratio (VAT %); 2: Fixed charge per transaction; 3: Fixed charge with month; 4: Fixed charge with days from last purchase; 5: Percent of pay amount; 6: Monthly Government Subsidy |
| name      | String    | Fee name    |
| value     | BigDecimal| Fee amount  |
| unitValue | BigDecimal| Fee unit amount |
| stepCredit| int       | Step level  |
| stepPrice | BigDecimal| Step price  |

#### Price

| Field     | Type      | Description |
|-----------|-----------|-------------|
| stepCredit| int       | Step level  |
| stepPrice | BigDecimal| Step price  |

#### Debt

| Field              | Type      | Description              |
|--------------------|-----------|--------------------------|
| name               | String    | Debt archive name        |
| balanceBeforeRepay | BigDecimal| Debt before repayment    |
| balanceAfterRepay  | BigDecimal| Debt after repayment     |
| repayAmount        | BigDecimal| Current repay for debt   |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": "",
  "orderNo": "219111111112502",
  "meterNo": "0159000000640",
  "customerName": "0159000000640",
  "sgc": 600615,
  "ti": 1,
  "amount": 100,
  "creditAmount": 95.24,
  "debtAmount": 0,
  "feeAmount": 4.76,
  "credit": 63.5,
  "kctToken1": "3330-3655-5982-2574-2945",
  "kctToken2": "5824-8151-0723-8904-2261",
  "token": "5679-9426-0693-2990-4432",
  "operator": "Kingbase",
  "merchant": "MerchantTest",
  "feeDetail": [
    {
      "feeType": 1,
      "name": "Fe2",
      "value": 4.7619,
      "unitValue": 5
    }
  ],
  "priceDetail": [
    {
      "stepCredit": 9999,
      "stepPrice": 1.5
    }
  ],
  "debtDetail": [],
  "subsidyToken": null,
  "subsidyCredit": 0
}
```

### Possible error codes

1, 1003, 2001, 3004, 3005, 3102, 3103, 9001

---

## Chapter 7. Generate OrderNo / Transaction ID

Generate a transaction ID for use in the transaction API.

### Endpoint

```
GET http://ip:port/vendingservice/getorderno?token=${token}
```

Alternative redirect: `/prepayservice/getorderno`

### Request parameters

| Name  | Type   | In   | Description                     |
|-------|--------|------|---------------------------------|
| token | String | Query| Session ID from login response |

### Response

| Field   | Type   | Description          |
|---------|--------|----------------------|
| orderNo | String | Transaction ID       |
| ordno   | String | Transaction ID       |
| crton   | String | Creation time        |
| crtby   | int    | Created by           |
| mch_id  | int    | Merchant ID          |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": "",
  "ordno": "219111111085201",
  "crton": "2019-11-11 11:08:52",
  "crtby": 17,
  "mch_id": 2
}
```

### Possible error codes

1003, 9001

---

## Chapter 8. Cancel Transaction

Cancel a transaction by its unique transaction ID.

### Endpoint

```
GET http://ip:port/vendingservice/cancellation?token=${token}&orderNo=${orderNo}
```

### Request parameters

| Name    | Type   | In   | Description                     |
|---------|--------|------|---------------------------------|
| token   | String | Query| Session ID from login response |
| orderNo | String | Query| Unique transaction ID           |

### Response

Standard `ServiceBaseVo`; may include `state` (e.g. 1 = success).

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": "",
  "state": 1
}
```

### Possible error codes

3001, 3002, 3006, 3007, 9001

---

## Chapter 9. Check Transaction

Check the status of a transaction.

### Endpoint

```
GET http://ip:port/vendingservice/checktransaction?token=${token}&orderNo=${orderNo}
```

### Request parameters

| Name    | Type   | In   | Description                     |
|---------|--------|------|---------------------------------|
| token   | String | Query| Session ID from login response |
| orderNo | String | Query| Unique transaction ID           |

### Response: ServiceBaseVo / CheckTransactionResponse

| Field | Type | Description |
|-------|------|-------------|
| state | int  | 1: Normal; 2: Canceled; 3: Does not exist |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": "",
  "state": 1
}
```

### Possible error codes

1003, 9001

---

## Chapter 10. Relay Open

Disconnect an electricity meter's relay (cuts power) — a "pulling" operation.

### Endpoint

```
GET http://ip:port/vendingservice/relayOpen?token=${token}&deviceSN=${deviceSN}
```

### Request parameters

| Name | Type | In | Description |
|------|------|----|--------------|
| token | `String` | Query | The session id, from `login` |
| deviceSN | `String` | Query | Device (meter) number |

### Response: ServiceBaseVo

| Member | Type | Description |
|--------|------|--------------|
| errorCode | `int` | `0` on success |
| errorMsg | `String` | Error message |
| errorDetails | `object` | Present on some failures (`code`, `message`) |
| data | `String` | `"Disconnected"` on success |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": null,
  "errorDetails": null,
  "data": "Disconnected",
  "object": null
}
```

### Example: failure

```json
{
  "errorCode": 1003,
  "errorMsg": "The session has expired",
  "data": null
}
```

### Possible error codes

`0, 8000, 9001, 1003, 1011, 1004, 1006, 1007, 1008, 1009, 1010, 9023, 9035`

---

## Chapter 11. Relay Closed

Reconnect an electricity meter's relay (restores power).

### Endpoint

```
GET http://ip:port/vendingservice/relayClosed?token=${token}&deviceSN=${deviceSN}
```

### Request parameters

| Name | Type | In | Description |
|------|------|----|--------------|
| token | `String` | Query | The session id, from `login` |
| deviceSN | `String` | Query | Device (meter) number |

### Response: ServiceBaseVo

| Member | Type | Description |
|--------|------|--------------|
| errorCode | `int` | `0` on success |
| errorMsg | `String` | Error message |
| errorDetails | `object` | Present on some failures (`code`, `message`) |
| data | `String` | `"Connected"` on success |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": null,
  "errorDetails": null,
  "data": "Connected",
  "object": null
}
```

### Example: failure

```json
{
  "errorCode": 9035,
  "errorMsg": "Relay operation failure",
  "errorDetails": { "code": 106, "message": "Meter cover open disconnect" }
}
```

### Possible error codes

`0, 8000, 9001, 1003, 1011, 1004, 1006, 1007, 1008, 1009, 1010, 9023, 9035`

---

## Chapter 12. Get Meter Relay Status

Gets one or more meters' relay (connected/disconnected) status.

### Endpoint

```
POST http://ip:port/vendingservice/relayStatus
```

### Request body

```json
{ "token": "55f41a55b5f54ed5851b4eb3b882d7ff", "meterNo": "70000320005" }
```

| Name | Type | Description |
|------|------|--------------|
| token | `String` | The session id, from `login` |
| meterNo | `String` | One meter number, or several joined with `,` |

### Response

| Member | Type | Description |
|--------|------|--------------|
| errorCode | `int` | `0` on success |
| errorMsg | `String` | Error message |
| data | `{ dataTmp: string }[]` | One entry per requested meter, **in request order** — not individually keyed by meter number |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": "SUCCESS",
  "data": [{ "dataTmp": "Connected" }]
}
```

### Example: failure

```json
{
  "errorCode": 1003,
  "errorMsg": "The session has expired",
  "data": null
}
```

### Possible error codes

`0, 8000, 9001, 1003, 1011, 1004, 1006, 1007, 1008, 1009, 1010, 9023`

---

## Chapter 13. Remote Write Token

Write an STS token to the meter remotely instead of keying it in on the meter's keypad.

### Endpoint

```
GET http://ip:port/vendingservice/writeToken?token=${token}&msno=${meterNo}&ststoken=${ststoken}
```

### Request parameters

| Name | Type | Description |
|------|------|--------------|
| token | `String` | The session id, from `login` |
| msno | `String` | Meter number |
| ststoken | `String` | STS token (20 digits) |

### Response: ServiceBaseVo

| Member | Type | Description |
|--------|------|--------------|
| errorCode | `int` | `0` on success |
| errorMsg | `String` | Error message |
| data | `String` | Vendor-defined; empty on success |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": "SUCCESS",
  "data": ""
}
```

### Example: failure

```json
{
  "errorCode": 1003,
  "errorMsg": "The session has expired"
}
```

### Possible error codes

`0, 9001, 1003, 1011, 1004, 1006, 1007, 9020, 9021, 9022, 9023, 9025, 9040`

---

## Summary: API flow for prepaid vending

1. **Login** → obtain `token` (sessionId)
2. **Get Balance** (optional) → check merchant balance
3. **Validation** → validate meter number and get customer info
4. **GetOrderNo** → obtain `orderNo`
5. **Transaction** → submit `orderNo`, `meterNo`, `amount`; receive recharge token
6. (Optional) **Check Transaction** → confirm status
7. (Optional) **Cancel Transaction** → cancel if needed
8. **Logout** → end session

---

*LONGI METER CO. LTD — No.25 Guangming Road, Yinchuan, 750021, China — overseas@longimeter.com — www.longimeter.com*
