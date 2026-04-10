import { useState } from 'react'
import { useLanguageStore } from '@/store/languageStore'

export interface FormulaCategory {
  id: string
  name: string
  nameEn: string
  formulas: FormulaInfo[]
}

export interface FormulaInfo {
  id: string
  name: string
  nameEn: string
  syntax: string
  description: string
  descriptionEn: string
  example: string
  exampleResult: string
  category: string
}

export const formulaCategories: FormulaCategory[] = [
  {
    id: 'math',
    name: '数学与三角函数',
    nameEn: 'Math & Trig',
    formulas: [
      { id: 'SUM', name: 'SUM', nameEn: 'SUM', syntax: 'SUM(number1, [number2], ...)', description: '计算一组数值的总和', descriptionEn: 'Returns the sum of a range of numbers', example: 'SUM(A1:A10)', exampleResult: '55', category: 'math' },
      { id: 'SUMIF', name: 'SUMIF', nameEn: 'SUMIF', syntax: 'SUMIF(range, criteria, [sum_range])', description: '对满足条件的单元格求和', descriptionEn: 'Sum values that meet criteria', example: 'SUMIF(A1:A10,">5")', exampleResult: '45', category: 'math' },
      { id: 'SUMIFS', name: 'SUMIFS', nameEn: 'SUMIFS', syntax: 'SUMIFS(sum_range, criteria_range1, criteria1, ...)', description: '对满足多个条件的单元格求和', descriptionEn: 'Sum values that meet multiple criteria', example: 'SUMIFS(C1:C10,A1:A10,">5",B1:B10,"<10")', exampleResult: '30', category: 'math' },
      { id: 'AVERAGE', name: 'AVERAGE', nameEn: 'AVERAGE', syntax: 'AVERAGE(number1, [number2], ...)', description: '计算一组数值的平均值', descriptionEn: 'Returns the average of numbers', example: 'AVERAGE(A1:A10)', exampleResult: '5.5', category: 'math' },
      { id: 'AVERAGEIF', name: 'AVERAGEIF', nameEn: 'AVERAGEIF', syntax: 'AVERAGEIF(range, criteria, [average_range])', description: '对满足条件的单元格求平均值', descriptionEn: 'Average values that meet criteria', example: 'AVERAGEIF(A1:A10,">5")', exampleResult: '7.5', category: 'math' },
      { id: 'COUNT', name: 'COUNT', nameEn: 'COUNT', syntax: 'COUNT(value1, [value2], ...)', description: '计算包含数字的单元格个数', descriptionEn: 'Count cells containing numbers', example: 'COUNT(A1:A10)', exampleResult: '10', category: 'math' },
      { id: 'COUNTA', name: 'COUNTA', nameEn: 'COUNTA', syntax: 'COUNTA(value1, [value2], ...)', description: '计算非空单元格个数', descriptionEn: 'Count non-empty cells', example: 'COUNTA(A1:A10)', exampleResult: '8', category: 'math' },
      { id: 'COUNTIF', name: 'COUNTIF', nameEn: 'COUNTIF', syntax: 'COUNTIF(range, criteria)', description: '计算满足条件的单元格个数', descriptionEn: 'Count cells meeting criteria', example: 'COUNTIF(A1:A10,">5")', exampleResult: '5', category: 'math' },
      { id: 'COUNTIFS', name: 'COUNTIFS', nameEn: 'COUNTIFS', syntax: 'COUNTIFS(criteria_range1, criteria1, ...)', description: '计算满足多个条件的单元格个数', descriptionEn: 'Count cells meeting multiple criteria', example: 'COUNTIFS(A1:A10,">5",B1:B10,"<10")', exampleResult: '3', category: 'math' },
      { id: 'MAX', name: 'MAX', nameEn: 'MAX', syntax: 'MAX(number1, [number2], ...)', description: '返回一组数值中的最大值', descriptionEn: 'Returns the maximum value', example: 'MAX(A1:A10)', exampleResult: '10', category: 'math' },
      { id: 'MIN', name: 'MIN', nameEn: 'MIN', syntax: 'MIN(number1, [number2], ...)', description: '返回一组数值中的最小值', descriptionEn: 'Returns the minimum value', example: 'MIN(A1:A10)', exampleResult: '1', category: 'math' },
      { id: 'ROUND', name: 'ROUND', nameEn: 'ROUND', syntax: 'ROUND(number, num_digits)', description: '将数字四舍五入到指定位数', descriptionEn: 'Round a number to specified digits', example: 'ROUND(3.14159, 2)', exampleResult: '3.14', category: 'math' },
      { id: 'ROUNDUP', name: 'ROUNDUP', nameEn: 'ROUNDUP', syntax: 'ROUNDUP(number, num_digits)', description: '向上舍入数字', descriptionEn: 'Round a number up', example: 'ROUNDUP(3.14159, 2)', exampleResult: '3.15', category: 'math' },
      { id: 'ROUNDDOWN', name: 'ROUNDDOWN', nameEn: 'ROUNDDOWN', syntax: 'ROUNDDOWN(number, num_digits)', description: '向下舍入数字', descriptionEn: 'Round a number down', example: 'ROUNDDOWN(3.14159, 2)', exampleResult: '3.14', category: 'math' },
      { id: 'INT', name: 'INT', nameEn: 'INT', syntax: 'INT(number)', description: '将数字向下取整', descriptionEn: 'Round down to nearest integer', example: 'INT(3.9)', exampleResult: '3', category: 'math' },
      { id: 'MOD', name: 'MOD', nameEn: 'MOD', syntax: 'MOD(number, divisor)', description: '返回除法的余数', descriptionEn: 'Returns the remainder of division', example: 'MOD(10, 3)', exampleResult: '1', category: 'math' },
      { id: 'ABS', name: 'ABS', nameEn: 'ABS', syntax: 'ABS(number)', description: '返回数字的绝对值', descriptionEn: 'Returns the absolute value', example: 'ABS(-5)', exampleResult: '5', category: 'math' },
      { id: 'SQRT', name: 'SQRT', nameEn: 'SQRT', syntax: 'SQRT(number)', description: '返回平方根', descriptionEn: 'Returns the square root', example: 'SQRT(16)', exampleResult: '4', category: 'math' },
      { id: 'POWER', name: 'POWER', nameEn: 'POWER', syntax: 'POWER(number, power)', description: '返回数字的幂', descriptionEn: 'Returns a number raised to a power', example: 'POWER(2, 3)', exampleResult: '8', category: 'math' },
      { id: 'RAND', name: 'RAND', nameEn: 'RAND', syntax: 'RAND()', description: '返回0到1之间的随机数', descriptionEn: 'Returns a random number between 0 and 1', example: 'RAND()', exampleResult: '0.543...', category: 'math' },
      { id: 'RANDBETWEEN', name: 'RANDBETWEEN', nameEn: 'RANDBETWEEN', syntax: 'RANDBETWEEN(bottom, top)', description: '返回指定范围内的随机整数', descriptionEn: 'Returns a random integer between specified numbers', example: 'RANDBETWEEN(1, 100)', exampleResult: '42', category: 'math' },
    ]
  },
  {
    id: 'text',
    name: '文本函数',
    nameEn: 'Text',
    formulas: [
      { id: 'CONCAT', name: 'CONCAT', nameEn: 'CONCAT', syntax: 'CONCAT(text1, [text2], ...)', description: '连接多个文本字符串', descriptionEn: 'Join multiple text strings', example: 'CONCAT(A1, " ", B1)', exampleResult: 'Hello World', category: 'text' },
      { id: 'CONCATENATE', name: 'CONCATENATE', nameEn: 'CONCATENATE', syntax: 'CONCATENATE(text1, [text2], ...)', description: '连接多个文本字符串', descriptionEn: 'Join multiple text strings', example: 'CONCATENATE(A1, " ", B1)', exampleResult: 'Hello World', category: 'text' },
      { id: 'LEFT', name: 'LEFT', nameEn: 'LEFT', syntax: 'LEFT(text, [num_chars])', description: '从文本左侧提取字符', descriptionEn: 'Extract characters from left', example: 'LEFT("Hello", 2)', exampleResult: 'He', category: 'text' },
      { id: 'RIGHT', name: 'RIGHT', nameEn: 'RIGHT', syntax: 'RIGHT(text, [num_chars])', description: '从文本右侧提取字符', descriptionEn: 'Extract characters from right', example: 'RIGHT("Hello", 2)', exampleResult: 'lo', category: 'text' },
      { id: 'MID', name: 'MID', nameEn: 'MID', syntax: 'MID(text, start_num, num_chars)', description: '从文本中间提取字符', descriptionEn: 'Extract characters from middle', example: 'MID("Hello", 2, 3)', exampleResult: 'ell', category: 'text' },
      { id: 'LEN', name: 'LEN', nameEn: 'LEN', syntax: 'LEN(text)', description: '返回文本字符串的长度', descriptionEn: 'Returns the length of text', example: 'LEN("Hello")', exampleResult: '5', category: 'text' },
      { id: 'UPPER', name: 'UPPER', nameEn: 'UPPER', syntax: 'UPPER(text)', description: '将文本转换为大写', descriptionEn: 'Convert text to uppercase', example: 'UPPER("hello")', exampleResult: 'HELLO', category: 'text' },
      { id: 'LOWER', name: 'LOWER', nameEn: 'LOWER', syntax: 'LOWER(text)', description: '将文本转换为小写', descriptionEn: 'Convert text to lowercase', example: 'LOWER("HELLO")', exampleResult: 'hello', category: 'text' },
      { id: 'PROPER', name: 'PROPER', nameEn: 'PROPER', syntax: 'PROPER(text)', description: '将文本首字母大写', descriptionEn: 'Capitalize first letter of each word', example: 'PROPER("hello world")', exampleResult: 'Hello World', category: 'text' },
      { id: 'TRIM', name: 'TRIM', nameEn: 'TRIM', syntax: 'TRIM(text)', description: '删除文本中的多余空格', descriptionEn: 'Remove extra spaces from text', example: 'TRIM("  Hello  World  ")', exampleResult: 'Hello World', category: 'text' },
      { id: 'SUBSTITUTE', name: 'SUBSTITUTE', nameEn: 'SUBSTITUTE', syntax: 'SUBSTITUTE(text, old_text, new_text, [instance_num])', description: '替换文本中的字符', descriptionEn: 'Replace text in a string', example: 'SUBSTITUTE("Hello World", "World", "Excel")', exampleResult: 'Hello Excel', category: 'text' },
      { id: 'REPLACE', name: 'REPLACE', nameEn: 'REPLACE', syntax: 'REPLACE(old_text, start_num, num_chars, new_text)', description: '替换文本中指定位置的字符', descriptionEn: 'Replace characters at specified position', example: 'REPLACE("Hello", 2, 3, "i")', exampleResult: 'Hio', category: 'text' },
      { id: 'FIND', name: 'FIND', nameEn: 'FIND', syntax: 'FIND(find_text, within_text, [start_num])', description: '在文本中查找子字符串位置', descriptionEn: 'Find position of substring', example: 'FIND("o", "Hello")', exampleResult: '5', category: 'text' },
      { id: 'SEARCH', name: 'SEARCH', nameEn: 'SEARCH', syntax: 'SEARCH(find_text, within_text, [start_num])', description: '在文本中查找子字符串（不区分大小写）', descriptionEn: 'Find position of substring (case-insensitive)', example: 'SEARCH("O", "Hello")', exampleResult: '5', category: 'text' },
      { id: 'TEXT', name: 'TEXT', nameEn: 'TEXT', syntax: 'TEXT(value, format_text)', description: '将数字格式化为文本', descriptionEn: 'Format number as text', example: 'TEXT(1234.5, "#,##0.00")', exampleResult: '1,234.50', category: 'text' },
      { id: 'VALUE', name: 'VALUE', nameEn: 'VALUE', syntax: 'VALUE(text)', description: '将文本转换为数字', descriptionEn: 'Convert text to number', example: 'VALUE("123")', exampleResult: '123', category: 'text' },
    ]
  },
  {
    id: 'date',
    name: '日期与时间函数',
    nameEn: 'Date & Time',
    formulas: [
      { id: 'TODAY', name: 'TODAY', nameEn: 'TODAY', syntax: 'TODAY()', description: '返回当前日期', descriptionEn: 'Returns current date', example: 'TODAY()', exampleResult: '2024/1/15', category: 'date' },
      { id: 'NOW', name: 'NOW', nameEn: 'NOW', syntax: 'NOW()', description: '返回当前日期和时间', descriptionEn: 'Returns current date and time', example: 'NOW()', exampleResult: '2024/1/15 14:30', category: 'date' },
      { id: 'YEAR', name: 'YEAR', nameEn: 'YEAR', syntax: 'YEAR(serial_number)', description: '返回日期的年份', descriptionEn: 'Returns the year of a date', example: 'YEAR("2024/1/15")', exampleResult: '2024', category: 'date' },
      { id: 'MONTH', name: 'MONTH', nameEn: 'MONTH', syntax: 'MONTH(serial_number)', description: '返回日期的月份', descriptionEn: 'Returns the month of a date', example: 'MONTH("2024/1/15")', exampleResult: '1', category: 'date' },
      { id: 'DAY', name: 'DAY', nameEn: 'DAY', syntax: 'DAY(serial_number)', description: '返回日期的天数', descriptionEn: 'Returns the day of a date', example: 'DAY("2024/1/15")', exampleResult: '15', category: 'date' },
      { id: 'HOUR', name: 'HOUR', nameEn: 'HOUR', syntax: 'HOUR(serial_number)', description: '返回时间的小时数', descriptionEn: 'Returns the hour of a time', example: 'HOUR("14:30:00")', exampleResult: '14', category: 'date' },
      { id: 'MINUTE', name: 'MINUTE', nameEn: 'MINUTE', syntax: 'MINUTE(serial_number)', description: '返回时间的分钟数', descriptionEn: 'Returns the minute of a time', example: 'MINUTE("14:30:00")', exampleResult: '30', category: 'date' },
      { id: 'SECOND', name: 'SECOND', nameEn: 'SECOND', syntax: 'SECOND(serial_number)', description: '返回时间的秒数', descriptionEn: 'Returns the second of a time', example: 'SECOND("14:30:45")', exampleResult: '45', category: 'date' },
      { id: 'DATE', name: 'DATE', nameEn: 'DATE', syntax: 'DATE(year, month, day)', description: '创建日期', descriptionEn: 'Create a date', example: 'DATE(2024, 1, 15)', exampleResult: '2024/1/15', category: 'date' },
      { id: 'TIME', name: 'TIME', nameEn: 'TIME', syntax: 'TIME(hour, minute, second)', description: '创建时间', descriptionEn: 'Create a time', example: 'TIME(14, 30, 0)', exampleResult: '14:30:00', category: 'date' },
      { id: 'DATEDIF', name: 'DATEDIF', nameEn: 'DATEDIF', syntax: 'DATEDIF(start_date, end_date, unit)', description: '计算两个日期之间的差', descriptionEn: 'Calculate difference between dates', example: 'DATEDIF("2024/1/1", "2024/1/15", "d")', exampleResult: '14', category: 'date' },
      { id: 'EDATE', name: 'EDATE', nameEn: 'EDATE', syntax: 'EDATE(start_date, months)', description: '返回指定月数之前或之后的日期', descriptionEn: 'Return date before/after specified months', example: 'EDATE("2024/1/15", 3)', exampleResult: '2024/4/15', category: 'date' },
      { id: 'EOMONTH', name: 'EOMONTH', nameEn: 'EOMONTH', syntax: 'EOMONTH(start_date, months)', description: '返回指定月数之前或之后的月末日期', descriptionEn: 'Return end of month date', example: 'EOMONTH("2024/1/15", 0)', exampleResult: '2024/1/31', category: 'date' },
      { id: 'WEEKDAY', name: 'WEEKDAY', nameEn: 'WEEKDAY', syntax: 'WEEKDAY(serial_number, [return_type])', description: '返回日期的星期几', descriptionEn: 'Returns day of week', example: 'WEEKDAY("2024/1/15")', exampleResult: '2', category: 'date' },
      { id: 'WEEKNUM', name: 'WEEKNUM', nameEn: 'WEEKNUM', syntax: 'WEEKNUM(serial_number, [return_type])', description: '返回日期的周数', descriptionEn: 'Returns week number', example: 'WEEKNUM("2024/1/15")', exampleResult: '3', category: 'date' },
    ]
  },
  {
    id: 'logical',
    name: '逻辑函数',
    nameEn: 'Logical',
    formulas: [
      { id: 'IF', name: 'IF', nameEn: 'IF', syntax: 'IF(logical_test, value_if_true, [value_if_false])', description: '根据条件返回不同的值', descriptionEn: 'Return different values based on condition', example: 'IF(A1>10, "大", "小")', exampleResult: '大', category: 'logical' },
      { id: 'IFS', name: 'IFS', nameEn: 'IFS', syntax: 'IFS(condition1, value1, [condition2, value2], ...)', description: '检查多个条件并返回对应值', descriptionEn: 'Check multiple conditions', example: 'IFS(A1>90, "A", A1>80, "B", A1>70, "C")', exampleResult: 'B', category: 'logical' },
      { id: 'AND', name: 'AND', nameEn: 'AND', syntax: 'AND(logical1, [logical2], ...)', description: '检查所有条件是否为真', descriptionEn: 'Check if all conditions are true', example: 'AND(A1>5, A1<10)', exampleResult: 'TRUE', category: 'logical' },
      { id: 'OR', name: 'OR', nameEn: 'OR', syntax: 'OR(logical1, [logical2], ...)', description: '检查任一条件是否为真', descriptionEn: 'Check if any condition is true', example: 'OR(A1>10, A1<5)', exampleResult: 'FALSE', category: 'logical' },
      { id: 'NOT', name: 'NOT', nameEn: 'NOT', syntax: 'NOT(logical)', description: '反转逻辑值', descriptionEn: 'Reverse logical value', example: 'NOT(TRUE)', exampleResult: 'FALSE', category: 'logical' },
      { id: 'XOR', name: 'XOR', nameEn: 'XOR', syntax: 'XOR(logical1, [logical2], ...)', description: '返回所有参数的异或值', descriptionEn: 'Return exclusive OR of arguments', example: 'XOR(TRUE, FALSE)', exampleResult: 'TRUE', category: 'logical' },
      { id: 'IFERROR', name: 'IFERROR', nameEn: 'IFERROR', syntax: 'IFERROR(value, value_if_error)', description: '如果公式出错则返回指定值', descriptionEn: 'Return specified value if error', example: 'IFERROR(1/0, "错误")', exampleResult: '错误', category: 'logical' },
      { id: 'IFNA', name: 'IFNA', nameEn: 'IFNA', syntax: 'IFNA(value, value_if_na)', description: '如果公式返回#N/A则返回指定值', descriptionEn: 'Return specified value if #N/A', example: 'IFNA(VLOOKUP(...), "未找到")', exampleResult: '未找到', category: 'logical' },
      { id: 'TRUE', name: 'TRUE', nameEn: 'TRUE', syntax: 'TRUE()', description: '返回逻辑值TRUE', descriptionEn: 'Return logical TRUE', example: 'TRUE()', exampleResult: 'TRUE', category: 'logical' },
      { id: 'FALSE', name: 'FALSE', nameEn: 'FALSE', syntax: 'FALSE()', description: '返回逻辑值FALSE', descriptionEn: 'Return logical FALSE', example: 'FALSE()', exampleResult: 'FALSE', category: 'logical' },
    ]
  },
  {
    id: 'lookup',
    name: '查找与引用函数',
    nameEn: 'Lookup & Reference',
    formulas: [
      { id: 'VLOOKUP', name: 'VLOOKUP', nameEn: 'VLOOKUP', syntax: 'VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])', description: '垂直查找', descriptionEn: 'Vertical lookup', example: 'VLOOKUP(A1, B1:D10, 2, FALSE)', exampleResult: '找到的值', category: 'lookup' },
      { id: 'HLOOKUP', name: 'HLOOKUP', nameEn: 'HLOOKUP', syntax: 'HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])', description: '水平查找', descriptionEn: 'Horizontal lookup', example: 'HLOOKUP(A1, B1:D10, 2, FALSE)', exampleResult: '找到的值', category: 'lookup' },
      { id: 'INDEX', name: 'INDEX', nameEn: 'INDEX', syntax: 'INDEX(array, row_num, [column_num])', description: '返回数组中指定位置的值', descriptionEn: 'Return value at specified position', example: 'INDEX(A1:C10, 5, 2)', exampleResult: '第5行第2列的值', category: 'lookup' },
      { id: 'MATCH', name: 'MATCH', nameEn: 'MATCH', syntax: 'MATCH(lookup_value, lookup_array, [match_type])', description: '返回匹配值的位置', descriptionEn: 'Return position of matched value', example: 'MATCH("苹果", A1:A10, 0)', exampleResult: '3', category: 'lookup' },
      { id: 'INDIRECT', name: 'INDIRECT', nameEn: 'INDIRECT', syntax: 'INDIRECT(ref_text, [a1])', description: '返回文本字符串指定的引用', descriptionEn: 'Return reference specified by text', example: 'INDIRECT("A" & B1)', exampleResult: 'A列的值', category: 'lookup' },
      { id: 'OFFSET', name: 'OFFSET', nameEn: 'OFFSET', syntax: 'OFFSET(reference, rows, cols, [height], [width])', description: '返回偏移指定行列数的引用', descriptionEn: 'Return reference offset from starting point', example: 'OFFSET(A1, 2, 3)', exampleResult: 'D3的值', category: 'lookup' },
      { id: 'ROW', name: 'ROW', nameEn: 'ROW', syntax: 'ROW([reference])', description: '返回引用的行号', descriptionEn: 'Return row number of reference', example: 'ROW(A5)', exampleResult: '5', category: 'lookup' },
      { id: 'COLUMN', name: 'COLUMN', nameEn: 'COLUMN', syntax: 'COLUMN([reference])', description: '返回引用的列号', descriptionEn: 'Return column number of reference', example: 'COLUMN(C5)', exampleResult: '3', category: 'lookup' },
      { id: 'ROWS', name: 'ROWS', nameEn: 'ROWS', syntax: 'ROWS(array)', description: '返回引用中的行数', descriptionEn: 'Return number of rows in reference', example: 'ROWS(A1:C10)', exampleResult: '10', category: 'lookup' },
      { id: 'COLUMNS', name: 'COLUMNS', nameEn: 'COLUMNS', syntax: 'COLUMNS(array)', description: '返回引用中的列数', descriptionEn: 'Return number of columns in reference', example: 'COLUMNS(A1:C10)', exampleResult: '3', category: 'lookup' },
      { id: 'CHOOSE', name: 'CHOOSE', nameEn: 'CHOOSE', syntax: 'CHOOSE(index_num, value1, [value2], ...)', description: '根据索引号返回值列表中的值', descriptionEn: 'Return value from list based on index', example: 'CHOOSE(2, "苹果", "香蕉", "橙子")', exampleResult: '香蕉', category: 'lookup' },
    ]
  },
  {
    id: 'statistical',
    name: '统计函数',
    nameEn: 'Statistical',
    formulas: [
      { id: 'STDEV', name: 'STDEV', nameEn: 'STDEV', syntax: 'STDEV(number1, [number2], ...)', description: '计算样本标准偏差', descriptionEn: 'Calculate sample standard deviation', example: 'STDEV(A1:A10)', exampleResult: '2.87', category: 'statistical' },
      { id: 'STDEVP', name: 'STDEVP', nameEn: 'STDEVP', syntax: 'STDEVP(number1, [number2], ...)', description: '计算总体标准偏差', descriptionEn: 'Calculate population standard deviation', example: 'STDEVP(A1:A10)', exampleResult: '2.72', category: 'statistical' },
      { id: 'VAR', name: 'VAR', nameEn: 'VAR', syntax: 'VAR(number1, [number2], ...)', description: '计算样本方差', descriptionEn: 'Calculate sample variance', example: 'VAR(A1:A10)', exampleResult: '8.25', category: 'statistical' },
      { id: 'VARP', name: 'VARP', nameEn: 'VARP', syntax: 'VARP(number1, [number2], ...)', description: '计算总体方差', descriptionEn: 'Calculate population variance', example: 'VARP(A1:A10)', exampleResult: '7.43', category: 'statistical' },
      { id: 'MEDIAN', name: 'MEDIAN', nameEn: 'MEDIAN', syntax: 'MEDIAN(number1, [number2], ...)', description: '返回中位数', descriptionEn: 'Returns the median', example: 'MEDIAN(A1:A10)', exampleResult: '5.5', category: 'statistical' },
      { id: 'MODE', name: 'MODE', nameEn: 'MODE', syntax: 'MODE(number1, [number2], ...)', description: '返回众数', descriptionEn: 'Returns the mode', example: 'MODE(A1:A10)', exampleResult: '5', category: 'statistical' },
      { id: 'RANK', name: 'RANK', nameEn: 'RANK', syntax: 'RANK(number, ref, [order])', description: '返回数字在列表中的排名', descriptionEn: 'Returns rank of number in list', example: 'RANK(A1, A1:A10)', exampleResult: '3', category: 'statistical' },
      { id: 'LARGE', name: 'LARGE', nameEn: 'LARGE', syntax: 'LARGE(array, k)', description: '返回数据集中第k个最大值', descriptionEn: 'Returns k-th largest value', example: 'LARGE(A1:A10, 2)', exampleResult: '9', category: 'statistical' },
      { id: 'SMALL', name: 'SMALL', nameEn: 'SMALL', syntax: 'SMALL(array, k)', description: '返回数据集中第k个最小值', descriptionEn: 'Returns k-th smallest value', example: 'SMALL(A1:A10, 2)', exampleResult: '2', category: 'statistical' },
      { id: 'PERCENTILE', name: 'PERCENTILE', nameEn: 'PERCENTILE', syntax: 'PERCENTILE(array, k)', description: '返回数据集中第k个百分点值', descriptionEn: 'Returns k-th percentile', example: 'PERCENTILE(A1:A10, 0.5)', exampleResult: '5.5', category: 'statistical' },
      { id: 'QUARTILE', name: 'QUARTILE', nameEn: 'QUARTILE', syntax: 'QUARTILE(array, quart)', description: '返回数据集的四分位数', descriptionEn: 'Returns quartile of data set', example: 'QUARTILE(A1:A10, 1)', exampleResult: '3', category: 'statistical' },
      { id: 'CORREL', name: 'CORREL', nameEn: 'CORREL', syntax: 'CORREL(array1, array2)', description: '返回两个数据集的相关系数', descriptionEn: 'Returns correlation coefficient', example: 'CORREL(A1:A10, B1:B10)', exampleResult: '0.85', category: 'statistical' },
    ]
  },
  {
    id: 'financial',
    name: '财务函数',
    nameEn: 'Financial',
    formulas: [
      { id: 'PMT', name: 'PMT', nameEn: 'PMT', syntax: 'PMT(rate, nper, pv, [fv], [type])', description: '计算贷款的每期付款额', descriptionEn: 'Calculate loan payment', example: 'PMT(0.05/12, 360, 100000)', exampleResult: '-536.82', category: 'financial' },
      { id: 'PV', name: 'PV', nameEn: 'PV', syntax: 'PV(rate, nper, pmt, [fv], [type])', description: '计算投资的现值', descriptionEn: 'Calculate present value', example: 'PV(0.05/12, 360, -536.82)', exampleResult: '100000', category: 'financial' },
      { id: 'FV', name: 'FV', nameEn: 'FV', syntax: 'FV(rate, nper, pmt, [pv], [type])', description: '计算投资的未来值', descriptionEn: 'Calculate future value', example: 'FV(0.05/12, 120, -100)', exampleResult: '1552.83', category: 'financial' },
      { id: 'NPER', name: 'NPER', nameEn: 'NPER', syntax: 'NPER(rate, pmt, pv, [fv], [type])', description: '计算投资的期数', descriptionEn: 'Calculate number of periods', example: 'NPER(0.05/12, -100, 1000)', exampleResult: '10.24', category: 'financial' },
      { id: 'RATE', name: 'RATE', nameEn: 'RATE', syntax: 'RATE(nper, pmt, pv, [fv], [type], [guess])', description: '计算投资的利率', descriptionEn: 'Calculate interest rate', example: 'RATE(12, -100, 1000)', exampleResult: '2.92%', category: 'financial' },
      { id: 'NPV', name: 'NPV', nameEn: 'NPV', syntax: 'NPV(rate, value1, [value2], ...)', description: '计算投资的净现值', descriptionEn: 'Calculate net present value', example: 'NPV(0.1, -1000, 300, 400, 500)', exampleResult: '31.89', category: 'financial' },
      { id: 'IRR', name: 'IRR', nameEn: 'IRR', syntax: 'IRR(values, [guess])', description: '计算投资的内部收益率', descriptionEn: 'Calculate internal rate of return', example: 'IRR(A1:A5)', exampleResult: '12%', category: 'financial' },
      { id: 'SLN', name: 'SLN', nameEn: 'SLN', syntax: 'SLN(cost, salvage, life)', description: '计算直线折旧', descriptionEn: 'Calculate straight-line depreciation', example: 'SLN(10000, 1000, 5)', exampleResult: '1800', category: 'financial' },
    ]
  },
]

interface FormulaLibraryProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (formula: string) => void
}

export function FormulaLibrary({ isOpen, onClose, onSelect }: FormulaLibraryProps) {
  const { language } = useLanguageStore()
  const [selectedCategory, setSelectedCategory] = useState('math')
  const [selectedFormula, setSelectedFormula] = useState<FormulaInfo | null>(null)
  const [searchText, setSearchText] = useState('')
  
  if (!isOpen) return null
  
  const filteredFormulas = searchText
    ? formulaCategories.flatMap(cat => cat.formulas).filter(f => 
        f.name.toLowerCase().includes(searchText.toLowerCase()) ||
        f.nameEn.toLowerCase().includes(searchText.toLowerCase()) ||
        f.description.includes(searchText) ||
        f.descriptionEn.toLowerCase().includes(searchText.toLowerCase())
      )
    : formulaCategories.find(c => c.id === selectedCategory)?.formulas || []
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[800px] h-[600px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">
            {language === 'zh' ? '插入函数' : 'Insert Function'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 border-b">
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder={language === 'zh' ? '搜索函数...' : 'Search functions...'}
            className="w-full px-3 py-2 border border-[#d0d0d0] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex-1 flex overflow-hidden">
          <div className="w-48 border-r overflow-y-auto">
            {!searchText && formulaCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedCategory === cat.id ? 'bg-blue-50 text-blue-600' : ''}`}
              >
                {language === 'zh' ? cat.name : cat.nameEn}
              </button>
            ))}
          </div>
          
          <div className="flex-1 flex">
            <div className="w-64 border-r overflow-y-auto">
              {filteredFormulas.map(formula => (
                <button
                  key={formula.id}
                  onClick={() => setSelectedFormula(formula)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${selectedFormula?.id === formula.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="font-medium text-sm">{formula.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {language === 'zh' ? formula.description : formula.descriptionEn}
                  </div>
                </button>
              ))}
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto">
              {selectedFormula ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-lg">{selectedFormula.name}</h4>
                    <p className="text-sm text-gray-600">
                      {language === 'zh' ? selectedFormula.description : selectedFormula.descriptionEn}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {language === 'zh' ? '语法' : 'Syntax'}
                    </label>
                    <div className="px-3 py-2 bg-gray-50 rounded font-mono text-sm">
                      {selectedFormula.syntax}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {language === 'zh' ? '示例' : 'Example'}
                    </label>
                    <div className="px-3 py-2 bg-gray-50 rounded font-mono text-sm">
                      {selectedFormula.example}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {language === 'zh' ? '结果' : 'Result'}
                    </label>
                    <div className="px-3 py-2 bg-green-50 rounded text-sm">
                      {selectedFormula.exampleResult}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      onSelect(selectedFormula.syntax.split('(')[0] + '()')
                      onClose()
                    }}
                    className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                  >
                    {language === 'zh' ? '插入函数' : 'Insert Function'}
                  </button>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  {language === 'zh' ? '选择一个函数查看详情' : 'Select a function to see details'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function evaluateFormula(formula: string, data: Record<string, unknown>): unknown {
  try {
    const funcName = formula.match(/^([A-Z]+)/)?.[1]
    if (!funcName) return '#ERROR!'
    
    const args = formula.match(/\((.*)\)$/)?.[1]?.split(',').map(a => a.trim()) || []
    
    switch (funcName) {
      case 'SUM':
        return args.reduce((sum, arg) => {
          const num = Number(data[arg] || arg)
          return sum + (isNaN(num) ? 0 : num)
        }, 0)
      case 'AVERAGE':
        const sum = args.reduce((s, arg) => {
          const num = Number(data[arg] || arg)
          return s + (isNaN(num) ? 0 : num)
        }, 0)
        return sum / args.length
      case 'COUNT':
        return args.filter(arg => !isNaN(Number(data[arg] || arg))).length
      case 'MAX':
        return Math.max(...args.map(arg => Number(data[arg] || arg) || 0))
      case 'MIN':
        return Math.min(...args.map(arg => Number(data[arg] || arg) || 0))
      case 'ABS':
        return Math.abs(Number(data[args[0]] || args[0]))
      case 'SQRT':
        return Math.sqrt(Number(data[args[0]] || args[0]))
      case 'ROUND':
        const num = Number(data[args[0]] || args[0])
        const digits = Number(args[1]) || 0
        return Math.round(num * Math.pow(10, digits)) / Math.pow(10, digits)
      case 'LEN':
        return String(data[args[0]] || args[0]).length
      case 'UPPER':
        return String(data[args[0]] || args[0]).toUpperCase()
      case 'LOWER':
        return String(data[args[0]] || args[0]).toLowerCase()
      case 'TODAY':
        return new Date().toLocaleDateString()
      case 'NOW':
        return new Date().toLocaleString()
      case 'YEAR':
        return new Date(String(data[args[0]] || args[0])).getFullYear()
      case 'MONTH':
        return new Date(String(data[args[0]] || args[0])).getMonth() + 1
      case 'DAY':
        return new Date(String(data[args[0]] || args[0])).getDate()
      case 'IF':
        const condition = args[0]
        const trueValue = args[1]
        const falseValue = args[2]
        return condition ? trueValue : falseValue
      case 'AND':
        return args.every(arg => Boolean(data[arg] || arg))
      case 'OR':
        return args.some(arg => Boolean(data[arg] || arg))
      case 'NOT':
        return !Boolean(data[args[0]] || args[0])
      case 'TRUE':
        return true
      case 'FALSE':
        return false
      case 'PI':
        return Math.PI
      case 'RAND':
        return Math.random()
      default:
        return '#NAME?'
    }
  } catch {
    return '#ERROR!'
  }
}
