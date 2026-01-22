import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminInitiateAuthCommand, AdminRespondToAuthChallengeCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({});

const USER_POOL_ID = process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Auth handler received event:', JSON.stringify(event, null, 2));

  try {
    const { httpMethod, path } = event;
    const body = event.body ? JSON.parse(event.body) : {};

    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    };

    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: '',
      };
    }

    if (path.endsWith('/register') && httpMethod === 'POST') {
      return await handleRegister(body);
    } else if (path.endsWith('/login') && httpMethod === 'POST') {
      return await handleLogin(body);
    } else if (path.endsWith('/confirm') && httpMethod === 'POST') {
      return await handleConfirm(body);
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Endpoint not found' }),
      };
    }

  } catch (error) {
    console.error('Error in auth handler:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

async function handleRegister(body: any): Promise<APIGatewayProxyResult> {
  const { username, email, password, firstName, lastName } = body;

  if (!username || !email || !password) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Missing required fields' }),
    };
  }

  try {
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: firstName || '' },
        { Name: 'family_name', Value: lastName || '' },
      ],
      MessageAction: 'SUPPRESS',
    });

    await cognitoClient.send(createUserCommand);

    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      Password: password,
      Permanent: true,
    });

    await cognitoClient.send(setPasswordCommand);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'User registered successfully',
        username,
        email,
      }),
    };

  } catch (error) {
    console.error('Registration error:', error);
    
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Registration failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

async function handleLogin(body: any): Promise<APIGatewayProxyResult> {
  const { username, password } = body;

  if (!username || !password) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Missing username or password' }),
    };
  }

  try {
    const authCommand = new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });

    const authResult = await cognitoClient.send(authCommand);

    if (authResult.AuthenticationResult) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Login successful',
          accessToken: authResult.AuthenticationResult.AccessToken,
          idToken: authResult.AuthenticationResult.IdToken,
          refreshToken: authResult.AuthenticationResult.RefreshToken,
          expiresIn: authResult.AuthenticationResult.ExpiresIn,
          username: username,
        }),
      };
    } else {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: 'Authentication failed',
          message: 'Invalid credentials',
        }),
      };
    }

  } catch (error) {
    console.error('Login error:', error);
    
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Login failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

async function handleConfirm(body: any): Promise<APIGatewayProxyResult> {
  const { username, confirmationCode } = body;

  if (!username || !confirmationCode) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Missing username or confirmation code' }),
    };
  }

  try {
    const confirmCommand = new AdminRespondToAuthChallengeCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      ChallengeName: 'ADMIN_NO_SRP_AUTH',
      ChallengeResponses: {
        USERNAME: username,
        NEW_PASSWORD: 'TemporaryPassword123!',
      },
    });

    await cognitoClient.send(confirmCommand);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: 'User confirmed successfully',
        username,
      }),
    };

  } catch (error) {
    console.error('Confirmation error:', error);
    
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Confirmation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}
