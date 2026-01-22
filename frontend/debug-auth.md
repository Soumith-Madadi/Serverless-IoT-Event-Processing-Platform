# 🔍 Authentication Debugging Guide

## 🚀 **Testing Steps**

1. **Open Browser**: Go to `http://localhost:3000`
2. **Check Console**: Open Developer Tools (F12) → Console tab
3. **Look for Logs**: You should see authentication logs

## 📝 **Expected Console Logs**

### **On Page Load:**
```
AuthContext: Checking for existing token on mount
AuthContext: Found token: false
AuthContext: Finished initialization
```

### **After Login:**
```
Login response: {message: "Login successful", accessToken: "...", ...}
Decoded JWT token: {sub: "...", cognito:username: "testuser2", ...}
Setting user data: {id: "...", username: "testuser2", ...}
ProtectedRoute - isAuthenticated: true, isLoading: false
```

## 🐛 **Common Issues & Solutions**

### **Issue: Not Redirecting After Login**
- **Check**: Console logs for authentication state
- **Solution**: Verify `isAuthenticated` becomes `true`

### **Issue: JWT Decode Error**
- **Check**: Console for "Error decoding JWT token"
- **Solution**: Verify token format in response

### **Issue: User State Not Updating**
- **Check**: React DevTools → Components → AuthContext
- **Solution**: Verify `user` state changes

## 🧪 **Test Credentials**
```
Username: testuser2
Password: TestPass123!
```

## 📱 **Manual Testing**
1. **Register**: Create new account
2. **Login**: Use credentials above
3. **Verify**: Should redirect to dashboard
4. **Check**: Header shows username
5. **Logout**: Click logout button
