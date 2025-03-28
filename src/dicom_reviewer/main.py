from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello_world():
    return 'Multi-Reviewer DICOM System - Development Environment'

if __name__ == '__main__':
    app.run(debug=True)
