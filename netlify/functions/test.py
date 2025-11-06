# netlify/functions/test.py
import json

def handler(event, context):
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
        },
        'body': json.dumps({
            'message': 'Netlify Python Function 工作正常！',
            'method': event.get('httpMethod'),
            'path': event.get('path')
        })
    }