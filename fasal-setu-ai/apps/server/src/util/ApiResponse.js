class ApiResponse {
    constructor(
        status,
        data,
        message = "Success",
        success = true
    ){
        this.status = status,
        this.data = data,
        this.message = message,
        this.success = success
    }
}

export {ApiResponse}