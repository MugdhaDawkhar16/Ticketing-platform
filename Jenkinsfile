
pipeline {
    agent {
        label 'ticketflow-windows'
    }

    options {
        skipDefaultCheckout(true)
        timestamps()
    }

    environment {
        IMAGE_PREFIX = 'ticketflow'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_SHA = bat(
                        script: '@git rev-parse --short=12 HEAD',
                        returnStdout: true
                    ).trim()
                    env.IMAGE_TAG = "ci-${env.GIT_SHA}"
                }
            }
        }

        stage('Validate Project') {
            steps {
                bat 'if not exist frontend\\package-lock.json exit /b 1'
                bat 'if not exist services\\event-service\\package-lock.json exit /b 1'
                bat 'if not exist services\\payment-service\\package-lock.json exit /b 1'
            }
        }

        stage('Frontend Lint') {
            steps {
                dir('frontend') {
                    bat 'npm ci'
                    bat 'npm run lint'
                }
            }
        }

       stage('Build Event Service') {
    steps {
        dir('services/event-service') {
            bat 'npm ci'
            withEnv(['DATABASE_URL=postgresql://ci:ci@localhost:5432/ticketflow_ci']) {
                bat 'npm run build'
            }
        }
    }
}

        stage('Build Payment Service') {
            steps {
                dir('services/payment-service') {
                    bat 'npm ci'
                    bat 'npm run build'
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                bat 'docker build -t ticketflow-frontend:%IMAGE_TAG% ./frontend'
                bat 'docker build -t ticketflow-event-service:%IMAGE_TAG% ./services/event-service'
                bat 'docker build -t ticketflow-payment-service:%IMAGE_TAG% ./services/payment-service'
            }
        }

        stage('Write Build Report') {
            steps {
                script {
                    writeFile file: 'ci-build-report.txt', text: """TicketFlow CI Build Report
Commit: ${env.GIT_SHA}
Image tag: ${env.IMAGE_TAG}
Frontend image: ticketflow-frontend:${env.IMAGE_TAG}
Event service image: ticketflow-event-service:${env.IMAGE_TAG}
Payment service image: ticketflow-payment-service:${env.IMAGE_TAG}
Registry push: No
Automatic deployment: No
"""
                }
                archiveArtifacts artifacts: 'ci-build-report.txt', fingerprint: true
            }
        }
    }

    post {
        success {
            echo "TicketFlow CI passed. Image tag: ${env.IMAGE_TAG}"
        }
        failure {
            echo 'TicketFlow CI failed. Review the first failing stage in Console Output.'
        }
    }
}
