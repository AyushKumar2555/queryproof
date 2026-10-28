pipeline {
    agent any

    stages {
        stage('Update the server') {
            steps {
                sshagent(credentials: ['queryproof-ec2']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=accept-new ubuntu@13.232.42.28 'bash -s' <<'EOF'
set -euo pipefail

update_server() {
    cd /home/ubuntu/queryproof
    pull_code
    install_api
    install_ai
    build_web
    restart_apps
}

pull_code() {
    git pull --ff-only
}

install_api() {
    npm install --prefix apps/api
}

install_ai() {
    apps/ai-service/.venv/bin/pip install -r apps/ai-service/requirements.txt
}

build_web() {
    npm install --prefix apps/web
    npm run build --prefix apps/web
}

restart_apps() {
    sudo systemctl restart queryproof-api queryproof-ai
}
update_server
EOF
                    '''
                }
            }
        }
    }
}
