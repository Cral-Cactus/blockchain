# Lowercase (params ignored)
def lower(value, params):
    return value.lower()

# Uppercase (params ignoredv)
def upper(value, params):
    return value.upper()

# Strips everything in the included list out of the value
# E.g. value = 'hello', params = ['h', 'l'] 
# Return: 'eo'
def strip(value, params):
    for param in params:
        value = value.strip(param)
    return value

# Replaces first parameter with second parameter
def replace(value, params):
    return value.replace(params[0], params[1])

cleaning_functions = {
    'lower': lower,
    'upper': upper,
    'strip': strip,
    'replace': replace,
}